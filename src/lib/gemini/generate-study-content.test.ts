import { describe, expect, it } from "vitest";

import { validateGenerateStudyContentInput } from "@/lib/gemini/generate-study-content";

describe("validateGenerateStudyContentInput", () => {
  it("accepts 1 image and short notes", () => {
    expect(() =>
      validateGenerateStudyContentInput({
        productName: "テスト商品",
        note: "短文",
        imageDataUrls: ["data:image/jpeg;base64,AAA"],
      }),
    ).not.toThrow();
  });

  it("accepts 4 images", () => {
    expect(() =>
      validateGenerateStudyContentInput({
        productName: "テスト商品",
        imageDataUrls: [
          "data:image/jpeg;base64,1",
          "data:image/jpeg;base64,2",
          "data:image/jpeg;base64,3",
          "data:image/jpeg;base64,4",
        ],
      }),
    ).not.toThrow();
  });

  it("rejects 0 images and more than 4 images", () => {
    expect(() =>
      validateGenerateStudyContentInput({
        productName: "テスト商品",
        imageDataUrls: [],
      }),
    ).toThrow();

    expect(() =>
      validateGenerateStudyContentInput({
        productName: "テスト商品",
        imageDataUrls: [
          "data:image/jpeg;base64,1",
          "data:image/jpeg;base64,2",
          "data:image/jpeg;base64,3",
          "data:image/jpeg;base64,4",
          "data:image/jpeg;base64,5",
        ],
      }),
    ).toThrow();
  });
});
