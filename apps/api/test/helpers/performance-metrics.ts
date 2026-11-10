export function summarizeLatencies(
  samples: number[],
  thresholdMs: number,
): {
  sampleCount: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  underThresholdCount: number;
} {
  if (samples.length === 0)
    throw new Error("At least one latency sample is required.");
  if (!Number.isFinite(thresholdMs) || thresholdMs < 0)
    throw new Error("Latency threshold must be a finite non-negative number.");
  if (samples.some((sample) => !Number.isFinite(sample) || sample < 0))
    throw new Error("Latency samples must be finite non-negative numbers.");

  const sorted = [...samples].sort((left, right) => left - right);
  const nearestRank = (percentile: number) =>
    sorted[Math.ceil((percentile / 100) * sorted.length) - 1]!;

  return {
    sampleCount: sorted.length,
    p50Ms: nearestRank(50),
    p95Ms: nearestRank(95),
    maxMs: sorted.at(-1)!,
    underThresholdCount: sorted.filter((sample) => sample < thresholdMs).length,
  };
}
