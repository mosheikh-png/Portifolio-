import { describe, expect, it } from "vitest";
import { ARABIC_CONTENT_DEFAULTS, CONTENT_DEFAULTS, getStoredContentKey, mergePortfolioContent } from "../shared/portfolioContent";

describe("portfolio content defaults", () => {
  it("merges stored values only for supported content keys", () => {
    const content = mergePortfolioContent([
      { key: "homeName", value: "Mohamed A." },
      { key: "unknownKey", value: "ignored" },
    ]);

    expect(content.homeName).toBe("Mohamed A.");
    expect(content.contactEmail).toBe(CONTENT_DEFAULTS.contactEmail);
    expect("unknownKey" in content).toBe(false);
  });

  it("uses Arabic defaults and only Arabic-prefixed stored content for Arabic pages", () => {
    const content = mergePortfolioContent([
      { key: "homeName", value: "English override" },
      { key: "ar:homeName", value: "محمد عادل المعدّل" },
    ], "ar");

    expect(content.homeName).toBe("محمد عادل المعدّل");
    expect(content.homeRole).toBe(ARABIC_CONTENT_DEFAULTS.homeRole);
    expect(getStoredContentKey("aboutLead", "ar")).toBe("ar:aboutLead");
    expect(getStoredContentKey("aboutLead", "en")).toBe("aboutLead");
  });
});
