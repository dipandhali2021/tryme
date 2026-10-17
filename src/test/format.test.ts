import { describe, expect, it } from "vitest";
import { formatClock } from "@/lib/format";

describe("formatClock", () => {
  it.each([
    [20, "0:20"],
    [5, "0:05"],
    [0, "0:00"],
    [60, "1:00"],
    [65, "1:05"],
  ])("formats %d seconds → %s", (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected);
  });

  it("clamps negatives to zero", () => {
    expect(formatClock(-3)).toBe("0:00");
  });
});
