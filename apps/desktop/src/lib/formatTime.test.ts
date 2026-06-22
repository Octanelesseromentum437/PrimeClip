import { describe, expect, it } from "vitest";
import { formatCueTime, parseCueTime, roundCueTime } from "./formatTime";

describe("formatCueTime", () => {
  it("formats sub-minute times", () => {
    expect(formatCueTime(0)).toBe("0:0.0");
    expect(formatCueTime(3.5)).toBe("0:3.5");
  });

  it("formats minute times", () => {
    expect(formatCueTime(65)).toBe("1:05.0");
  });
});

describe("parseCueTime", () => {
  it("parses M:SS.s", () => {
    expect(parseCueTime("0:3.5")).toBe(3.5);
    expect(parseCueTime("1:05.0")).toBe(65);
  });

  it("parses plain seconds", () => {
    expect(parseCueTime("12.3")).toBe(12.3);
  });

  it("returns null for invalid input", () => {
    expect(parseCueTime("bad")).toBeNull();
  });
});

describe("roundCueTime", () => {
  it("rounds to one decimal", () => {
    expect(roundCueTime(1.234)).toBe(1.2);
  });
});
