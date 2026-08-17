import { describe, expect, it } from "vitest";
import { UI_COPY } from "./localization";

describe("portfolio localization", () => {
  it("provides matching Arabic and English interface keys", () => {
    expect(Object.keys(UI_COPY.ar).sort()).toEqual(Object.keys(UI_COPY.en).sort());
  });

  it("keeps Arabic UI labels available for the RTL interface", () => {
    expect(UI_COPY.ar.contactMe).toBe("تواصل معي");
    expect(UI_COPY.en.contactMe).toBe("Contact Me");
  });
});
