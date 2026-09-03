import { describe, expect, it } from "vitest";
import { containsProfanity, maskProfanity } from "@/lib/moderation/profanity";

describe("profanity filter", () => {
  it("detects plain and spaced/obfuscated words", () => {
    expect(containsProfanity("이거 진짜 병신 같네")).toBe(true);
    expect(containsProfanity("시 발 진짜")).toBe(true);
    expect(containsProfanity("ㅅㅂ 왜 2등임")).toBe(true);
    expect(containsProfanity("작화가 좋고 스토리가 탄탄하다")).toBe(false);
  });
  it("masks while keeping first char", () => {
    const m = maskProfanity("병신 같은 결말");
    expect(m).not.toContain("병신");
    expect(m.startsWith("병*")).toBe(true);
    expect(maskProfanity("fuck this")).toBe("f*** this");
  });
});
