import { describe, expect, it } from "vitest";
import { cuesToWebVTT } from "./webvtt";

describe("cuesToWebVTT", () => {
  it("formats valid cues as WebVTT", () => {
    const vtt = cuesToWebVTT([
      { start: 0, end: 1.5, text: "Hello" },
      { start: 65.25, end: 3665.5, text: "World" },
    ]);

    expect(vtt).toContain("WEBVTT");
    expect(vtt).toContain("00:00:00.000 --> 00:00:01.500");
    expect(vtt).toContain("Hello");
    expect(vtt).toContain("00:01:05.250 --> 01:01:05.500");
    expect(vtt).toContain("World");
  });

  it("skips empty text and invalid time ranges", () => {
    const vtt = cuesToWebVTT([
      { start: 0, end: 0, text: "zero duration" },
      { start: 2, end: 1, text: "backwards" },
      { start: 3, end: 4, text: "   " },
      { start: 5, end: 6, text: "keep" },
    ]);

    expect(vtt).not.toContain("zero duration");
    expect(vtt).not.toContain("backwards");
    expect(vtt).toContain("keep");
  });
});
