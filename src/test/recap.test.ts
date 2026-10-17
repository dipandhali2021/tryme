import { describe, expect, it } from "vitest";
import { recapFileName } from "@/lib/decart/recorder";

describe("recapFileName", () => {
  it("stamps the local date and time", () => {
    expect(recapFileName(new Date(2026, 9, 17, 14, 5))).toBe(
      "tryme-20261017-1405.webm",
    );
  });

  it("pads single-digit months, days, hours and minutes", () => {
    expect(recapFileName(new Date(2026, 0, 3, 9, 7))).toBe(
      "tryme-20260103-0907.webm",
    );
  });
});
