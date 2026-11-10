import { describe, expect, it } from "@jest/globals";
import { summarizeLatencies } from "./helpers/performance-metrics.js";

describe("summarizeLatencies", () => {
  it("summarizes nearest-rank percentiles and threshold counts", () => {
    const result = summarizeLatencies(
      Array.from({ length: 100 }, (_, index) => index + 1),
      50,
    );

    expect(result).toEqual({
      sampleCount: 100,
      p50Ms: 50,
      p95Ms: 95,
      maxMs: 100,
      underThresholdCount: 49,
    });
  });

  it("rejects an empty sample set", () => {
    expect(() => summarizeLatencies([], 2_000)).toThrow(
      "At least one latency sample is required.",
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    "rejects invalid latency sample %s",
    (sample) => {
      expect(() => summarizeLatencies([sample], 2_000)).toThrow(
        "Latency samples must be finite non-negative numbers.",
      );
    },
  );

  it("rejects an invalid threshold", () => {
    expect(() => summarizeLatencies([10], Number.NaN)).toThrow(
      "Latency threshold must be a finite non-negative number.",
    );
  });
});
