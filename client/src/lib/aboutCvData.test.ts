import { describe, expect, it } from "vitest";
import { getCvData } from "./aboutCvData";

describe("About CV content", () => {
  it("provides the full set of CV sections used by the About page", () => {
    const cv = getCvData("en");
    expect(cv.software).toHaveLength(8);
    expect(cv.languages).toHaveLength(4);
    expect(cv.experience).toHaveLength(4);
    expect(cv.skills.length).toBeGreaterThanOrEqual(8);
  });

  it("keeps language progress values within the visible four-dot scale", () => {
    expect(getCvData("ar").languages.every((language) => language.dots >= 1 && language.dots <= 4)).toBe(true);
  });
});
