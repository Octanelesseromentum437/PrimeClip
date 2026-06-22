import { describe, expect, it } from "vitest";
import { computePeaks, mergeChannels, slicePeaks } from "./audioPeaks";

describe("computePeaks", () => {
  it("returns max amplitude per block", () => {
    const samples = new Float32Array([0, 0.5, -0.8, 0.1, 0.9, -0.2]);
    const peaks = computePeaks(samples, 3);
    expect(peaks.length).toBe(3);
    expect(peaks[0]).toBeCloseTo(0.5);
    expect(peaks[1]).toBeCloseTo(0.8);
    expect(peaks[2]).toBeCloseTo(0.9);
  });
});

describe("slicePeaks", () => {
  it("slices peaks by time range", () => {
    const peaks = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]);
    const sliced = slicePeaks(peaks, 10, 2, 5);
    expect(sliced.length).toBeGreaterThan(0);
    expect(sliced[0]).toBeCloseTo(0.3);
    expect(sliced[sliced.length - 1]).toBeLessThanOrEqual(0.6);
  });
});

describe("mergeChannels", () => {
  it("averages multiple channels", () => {
    const buffer = {
      length: 4,
      numberOfChannels: 2,
      getChannelData: (channel: number) =>
        channel === 0
          ? new Float32Array([1, 0, 0, 0])
          : new Float32Array([0, 1, 0, 0]),
    } as AudioBuffer;
    const merged = mergeChannels(buffer);
    expect(merged[0]).toBeCloseTo(0.5);
    expect(merged[1]).toBeCloseTo(0.5);
  });
});
