import { GeminiApiCallStatus } from "@/generated/prisma/client";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { getGeminiConfig } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { MAX_IMAGE_COUNT } from "@/lib/study/constants";
import { getOrCreateDefaultUser } from "@/lib/study/service";

const aiOutputSchema = z.object({
  summary: z.string().min(20).max(300),
  question: z.string().min(20).max(700),
  answer: z.string().min(40).max(900),
  explanation: z.string().min(40).max(1200),
  tags: z.array(z.string().min(1).max(40)).max(8),
  difficulty: z.enum(["easy", "medium", "hard"]),
  key_points: z.array(z.string().min(1).max(120)).min(3).max(8),
});

const geminiOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "question",
    "answer",
    "explanation",
    "tags",
    "difficulty",
    "key_points",
  ],
  properties: {
    summary: { type: "string" },
    question: { type: "string" },
    answer: { type: "string" },
    explanation: { type: "string" },
    tags: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    difficulty: {
      type: "string",
      enum: ["easy", "medium", "hard"],
    },
    key_points: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 8,
    },
  },
} as const;

export type GeneratedStudyContent = {
  summary: string;
  question: string;
  answer: string;
  explanation: string;
  tags: string[];
  difficulty: "easy" | "medium" | "hard";
  keyPoints: string[];
};

type GenerateStudyContentInput = {
  productName?: string | null;
  brandName?: string | null;
  note?: string | null;
  memo?: string | null;
  imageDataUrls: string[];
};

const generateStudyContentInputSchema = z.object({
  productName: z.string().optional().nullable(),
  brandName: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  memo: z.string().optional().nullable(),
  imageDataUrls: z.array(z.string().min(1)).min(1).max(MAX_IMAGE_COUNT),
});

function buildPrompt(input: GenerateStudyContentInput) {
  return [
    "メルカリ物販の学習用に、日本語で1問だけ作成してください。",
    "画像から読み取れる内容とテキスト情報の両方を使い、実務で再利用できる気づきを優先してください。",
    "問題は『なぜ売れたのか』『見るべきポイント』『需要のある層』『出品時の注意点』のいずれかを扱ってください。",
    "補足情報に書かれた内容は、問題文の主材料として具体的に織り込んでください。",
    "自由メモに書かれた内容は、解説の主材料として具体的に反映してください。自由メモが空なら、画像と補足情報だけで解説してください。",
    "模範解答は短すぎず、実務でそのまま使える密度にしてください。",
    "解説では再発見がある内容にしてください。",
    "指定した JSON schema に厳密に従って返してください。",
    "",
    `商品名: ${input.productName || "未入力"}`,
    `ブランド名: ${input.brandName || "未入力"}`,
    `補足情報: ${input.note || "未入力"}`,
    `自由メモ: ${input.memo || "未入力"}`,
  ].join("\n");
}

function dataUrlToInlineData(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);

  if (!match) {
    throw new Error("画像データの形式が不正です。");
  }

  const [, mimeType, data] = match;
  return {
    mimeType,
    data,
  };
}

export function validateGenerateStudyContentInput(input: GenerateStudyContentInput) {
  return generateStudyContentInputSchema.parse(input);
}

export async function generateStudyContent(
  input: GenerateStudyContentInput,
): Promise<GeneratedStudyContent> {
  const validatedInput = validateGenerateStudyContentInput(input);
  const config = getGeminiConfig();
  const prompt = buildPrompt(validatedInput);
  const client = new GoogleGenAI({
    apiKey: config.apiKey,
  });

  try {
    const response = await client.models.generateContent({
      model: config.model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
            ...validatedInput.imageDataUrls.map((imageUrl) => ({
              inlineData: dataUrlToInlineData(imageUrl),
            })),
          ],
        },
      ],
      config: {
        systemInstruction:
          "あなたはメルカリ物販の学習コーチです。画像と補足情報から、復習効果の高い学習問題を1つ作成してください。",
        responseMimeType: "application/json",
        responseJsonSchema: geminiOutputJsonSchema,
      },
    });

    if (!response.text) {
      console.error("Gemini generation returned empty structured output", {
        model: config.model,
        imageCount: validatedInput.imageDataUrls.length,
        noteLength: validatedInput.note?.trim().length || 0,
      });
      throw new Error("AIから問題生成結果を正しく受け取れませんでした。");
    }

    const parsedJson = JSON.parse(response.text);
    const output = aiOutputSchema.parse(parsedJson);

    const user = await getOrCreateDefaultUser();
    await prisma.geminiApiCallLog.create({
      data: {
        userId: user.id,
        status: GeminiApiCallStatus.SUCCESS,
        model: config.model,
        promptLength: prompt.length,
        imageCount: validatedInput.imageDataUrls.length,
        responseLength: response.text.length,
      },
    });

    return {
      summary: output.summary.trim(),
      question: output.question.trim(),
      answer: output.answer.trim(),
      explanation: output.explanation.trim(),
      tags: output.tags.map((tag) => tag.trim()).filter(Boolean),
      difficulty: output.difficulty,
      keyPoints: output.key_points.map((point) => point.trim()).filter(Boolean),
    };
  } catch (error) {
    console.error("Gemini generation failed", {
      model: config.model,
      imageCount: validatedInput.imageDataUrls.length,
      noteLength: validatedInput.note?.trim().length || 0,
      hasMemo: Boolean(validatedInput.memo?.trim()),
      productName: validatedInput.productName || null,
      error,
    });

    if (error instanceof Error && error.message.includes("Gemini")) {
      throw error;
    }

    if (error instanceof z.ZodError) {
      throw new Error("AIから受け取ったJSONが想定形式ではありません。時間をおいて再試行してください。");
    }

    if (error instanceof SyntaxError) {
      const user = await getOrCreateDefaultUser();
      await prisma.geminiApiCallLog.create({
        data: {
          userId: user.id,
          status: GeminiApiCallStatus.FAILED,
          model: config.model,
          promptLength: prompt.length,
          imageCount: validatedInput.imageDataUrls.length,
          errorMessage: error.message.slice(0, 500),
        },
      });
      throw new Error("AIから問題生成結果をJSONとして正しく受け取れませんでした。時間をおいて再試行してください。");
    }

    const user = await getOrCreateDefaultUser();
    await prisma.geminiApiCallLog.create({
      data: {
        userId: user.id,
        status: GeminiApiCallStatus.FAILED,
        model: config.model,
        promptLength: prompt.length,
        imageCount: validatedInput.imageDataUrls.length,
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      },
    });

    throw new Error(
      "Geminiによる問題生成に失敗しました。APIキー、利用状況、入力画像を確認して再試行してください。",
    );
  }
}
