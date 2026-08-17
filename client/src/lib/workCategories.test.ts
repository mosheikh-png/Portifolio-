import { describe, expect, it } from "vitest";
import { getWorkCategoryBySlug, WORK_CATEGORIES } from "./workCategories";

describe("work category routes", () => {
  it("keeps the six portfolio categories available by unique route slugs", () => {
    expect(WORK_CATEGORIES).toHaveLength(6);
    expect(new Set(WORK_CATEGORIES.map((category) => category.slug)).size).toBe(6);
    expect(getWorkCategoryBySlug("social-media")?.title).toBe("Social Media");
  });

  it("returns no category for an unknown route", () => {
    expect(getWorkCategoryBySlug("unknown-category")).toBeUndefined();
  });
});
