import { describe, expect, it } from "vitest";
import { slugify, yearOf, dateOf } from "@/scripts/collect/common";

describe("slugify", () => {
  it("keeps korean, appends external id", () => {
    expect(slugify("나 혼자만 레벨업", 123)).toBe("나-혼자만-레벨업-123");
    expect(slugify("Harry Potter: Order!", "tmdb-1")).toBe("harry-potter-order-tmdb-1");
    expect(slugify("!!!", 9)).toBe("item-9");
  });
  it("year/date parsing", () => {
    expect(yearOf("2024-05-01")).toBe(2024);
    expect(yearOf(null)).toBeNull();
    expect(dateOf("2024")).toBe("2024-01-01");
    expect(dateOf("2024-05-01T00:00:00Z")).toBe("2024-05-01");
  });
});
