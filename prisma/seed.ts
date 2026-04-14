import "dotenv/config";

import { addDays, startOfDay, subDays } from "date-fns";
import { File } from "node:buffer";
import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient,
  ProductStudyImageKind,
  ReviewActionType,
} from "../src/generated/prisma/client";
import { saveUploadedImages } from "../src/lib/storage/local";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL || "",
  }),
});

async function ensureSeedImages() {
  const svgTemplates = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
      <rect width="100%" height="100%" fill="#f8f4ea" />
      <text x="50%" y="45%" text-anchor="middle" font-size="40" fill="#1f2937">物販画像サンプル 1</text>
      <text x="50%" y="58%" text-anchor="middle" font-size="22" fill="#6b7280">ブランド小物 / 箱付き / 美品</text>
    </svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
      <rect width="100%" height="100%" fill="#eff6ff" />
      <text x="50%" y="45%" text-anchor="middle" font-size="40" fill="#0f172a">物販画像サンプル 2</text>
      <text x="50%" y="58%" text-anchor="middle" font-size="22" fill="#475569">家電 / 付属品あり / 動作品</text>
    </svg>`,
  ];

  const files = svgTemplates.map(
    (svgTemplate, index) =>
      new File([svgTemplate], `seed-${index + 1}.svg`, {
        type: "image/svg+xml",
      }),
  );

  return {
    walletImages: await saveUploadedImages([files[0]], ProductStudyImageKind.QUESTION),
    ironImages: await saveUploadedImages([files[1]], ProductStudyImageKind.QUESTION),
    vintageImages: await saveUploadedImages(files, ProductStudyImageKind.QUESTION),
  };
}

async function main() {
  const { walletImages, ironImages, vintageImages } = await ensureSeedImages();
  const today = startOfDay(new Date());

  await prisma.activeConversationState.deleteMany();
  await prisma.reviewLog.deleteMany();
  await prisma.productStudyImage.deleteMany();
  await prisma.productStudyItem.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      discordUserId: process.env.DISCORD_DEFAULT_USER_ID || null,
      lineUserId: process.env.LINE_DEFAULT_USER_ID || null,
      displayName: "ローカル利用者",
    },
  });

  const item1 = await prisma.productStudyItem.create({
    data: {
      userId: user.id,
      questionNumber: 1,
      productName: "ブランド財布",
      brandName: "COACH",
      category: "財布",
      note: "角スレが少なく、箱付き。ターゲットはギフト需要も意識する。",
      memo: "付属品ありで単価を上げる練習用。",
      firstScheduledAt: today,
      nextScheduledAt: today,
      status: "PENDING",
      summary: "箱付きのブランド財布。状態が良く、ギフト需要にも刺さる。",
      question:
        "このブランド財布が売れやすい理由と、出品時に必ず確認すべきポイントを説明してください。",
      answer:
        "ブランド認知に加え、箱付きでギフト需要を拾える点が強いです。角スレやファスナー動作、内側の汚れ、付属品の有無を明示すると購入判断が早くなります。",
      explanation:
        "財布は状態差で価格が大きく動くカテゴリです。外観だけでなく内側や金具、付属品まで揃えると『安心して買える出品』になります。",
      difficulty: "medium",
      tags: ["ブランド", "財布", "付属品"],
      keyPoints: ["角スレ確認", "付属品の価値", "ギフト需要"],
      images: {
        create: walletImages.map((image) => ({
          kind: image.kind,
          imagePath: image.imagePath,
          sortOrder: image.sortOrder,
        })),
      },
    },
  });

  const item2 = await prisma.productStudyItem.create({
    data: {
      userId: user.id,
      questionNumber: 2,
      productName: "スチームアイロン",
      brandName: "Panasonic",
      category: "家電",
      note: "動作品。付属品あり。季節家電ではないので通年回転しやすい。",
      memo: "説明書あり。",
      firstScheduledAt: subDays(today, 2),
      nextScheduledAt: addDays(today, 6),
      status: "CORRECT",
      summary: "動作品の国内ブランド家電。通年需要があり、説明書付きで安心感がある。",
      question:
        "この家電を販売するときに、購入者が安心する情報を3つ挙げてください。",
      answer:
        "通電と動作確認、付属品の有無、使用感や傷の状態です。家電は『届いてすぐ使えるか』が購入判断に直結します。",
      explanation:
        "家電は不安要素を先回りして潰すと売れやすくなります。写真だけでなく、動作確認済みの一文と欠品情報の明記が重要です。",
      difficulty: "easy",
      tags: ["家電", "動作確認", "安心感"],
      keyPoints: ["通電確認", "付属品明記", "傷の説明"],
      images: {
        create: ironImages.map((image) => ({
          kind: image.kind,
          imagePath: image.imagePath,
          sortOrder: image.sortOrder,
        })),
      },
      reviewLogs: {
        create: [
          {
            userId: user.id,
            actionType: ReviewActionType.SENT,
            actionAt: subDays(today, 1),
          },
          {
            userId: user.id,
            actionType: ReviewActionType.ANSWER_SHOWN,
            actionAt: subDays(today, 1),
            rawText: "解答",
          },
          {
            userId: user.id,
            actionType: ReviewActionType.CORRECT,
            actionAt: subDays(today, 1),
            rawText: "正解",
          },
        ],
      },
    },
  });

  const item3 = await prisma.productStudyItem.create({
    data: {
      userId: user.id,
      questionNumber: 3,
      productName: "ヴィンテージ腕時計",
      brandName: "SEIKO",
      category: "腕時計",
      note: "動作はしているが、ベルトに使用感あり。コレクター層向け。",
      memo: "相場確認を丁寧に。",
      firstScheduledAt: subDays(today, 1),
      nextScheduledAt: today,
      status: "ANSWER_SHOWN",
      summary: "コレクター需要のあるヴィンテージ時計。状態説明と市場理解が重要。",
      question:
        "ヴィンテージ腕時計で利益を残すために、相場確認時に見るべき観点を説明してください。",
      answer:
        "型番の一致、稼働状態、純正パーツかどうか、ベルトや風防の交換歴、同程度コンディションの販売履歴を確認します。",
      explanation:
        "ヴィンテージは同じブランドでも型番や純正性で価格が大きく変わります。『見た目が似ている』だけで仕入れると利益が崩れます。",
      difficulty: "hard",
      tags: ["ヴィンテージ", "時計", "相場確認"],
      keyPoints: ["型番一致", "純正パーツ", "販売履歴比較"],
      images: {
        create: vintageImages.map((image) => ({
          kind: image.kind,
          imagePath: image.imagePath,
          sortOrder: image.sortOrder,
        })),
      },
      reviewLogs: {
        create: [
          {
            userId: user.id,
            actionType: ReviewActionType.SENT,
            actionAt: subDays(today, 1),
          },
          {
            userId: user.id,
            actionType: ReviewActionType.ANSWER_SHOWN,
            actionAt: subDays(today, 1),
            rawText: "解答",
          },
        ],
      },
    },
  });

  await prisma.activeConversationState.create({
    data: {
      userId: user.id,
      itemId: item3.id,
      state: "ANSWER_SHOWN",
    },
  });

  console.info("Seed completed", {
    userId: user.id,
    itemIds: [item1.id, item2.id, item3.id],
  });
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
