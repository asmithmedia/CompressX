import { describe, it, expect } from "vitest";
import {
  assessReport,
  percentDelta,
  type BenchmarkReport,
} from "../src/core/benchmark-report.js";

function baseReport(overrides: Partial<BenchmarkReport> = {}): BenchmarkReport {
  return {
    originalLabel: "qwen3:4b",
    compressedLabel: "qwen3:4b-cx",
    originalSizeGb: 8.0,
    compressedSizeGb: 2.5,
    originalBench: {
      promptEvalTokensPerSec: 500,
      generationTokensPerSec: 50,
      loadTimeSec: 2,
      raw: "",
    },
    compressedBench: {
      promptEvalTokensPerSec: 650,
      generationTokensPerSec: 75,
      loadTimeSec: 1.2,
      raw: "",
    },
    originalPerplexity: { perplexity: 7.2, raw: "" },
    compressedPerplexity: { perplexity: 7.4, raw: "" },
    battery: { total: 10, matching: 10, diverged: 0, details: [] },
    ...overrides,
  };
}

describe("percentDelta", () => {
  it("computes basic deltas", () => {
    expect(percentDelta(100, 150)).toBe(50);
    expect(percentDelta(100, 50)).toBe(-50);
    expect(percentDelta(100, 100)).toBe(0);
  });

  it("returns 0 when original is 0 (no division by zero)", () => {
    expect(percentDelta(0, 100)).toBe(0);
  });
});

describe("assessReport", () => {
  it("returns excellent for small perplexity delta and matching prompts", () => {
    const a = assessReport(baseReport({
      originalPerplexity: { perplexity: 7.0, raw: "" },
      compressedPerplexity: { perplexity: 7.1, raw: "" }, // +1.4%
    }));
    expect(a.verdict).toBe("excellent");
  });

  it("returns good for typical 3-8% perplexity delta", () => {
    const a = assessReport(baseReport({
      originalPerplexity: { perplexity: 7.0, raw: "" },
      compressedPerplexity: { perplexity: 7.4, raw: "" }, // ~5.7%
    }));
    expect(a.verdict).toBe("good");
  });

  it("returns acceptable for 8-15% perplexity delta", () => {
    const a = assessReport(baseReport({
      originalPerplexity: { perplexity: 7.0, raw: "" },
      compressedPerplexity: { perplexity: 7.8, raw: "" }, // ~11.4%
    }));
    expect(a.verdict).toBe("acceptable");
  });

  it("returns risky for >15% perplexity delta", () => {
    const a = assessReport(baseReport({
      originalPerplexity: { perplexity: 7.0, raw: "" },
      compressedPerplexity: { perplexity: 8.5, raw: "" }, // ~21%
    }));
    expect(a.verdict).toBe("risky");
  });

  it("downgrades verdict when too many prompts diverge", () => {
    const a = assessReport(baseReport({
      originalPerplexity: { perplexity: 7.0, raw: "" },
      compressedPerplexity: { perplexity: 7.1, raw: "" }, // otherwise excellent
      battery: { total: 10, matching: 5, diverged: 5, details: [] }, // 50% divergence
    }));
    expect(a.verdict).toBe("risky");
  });

  it("works without perplexity when binary is unavailable", () => {
    const a = assessReport(baseReport({
      originalPerplexity: null,
      compressedPerplexity: null,
    }));
    // Default starts at "good"; matching prompt battery keeps it there
    expect(["excellent", "good"]).toContain(a.verdict);
    expect(a.bullets.length).toBeGreaterThan(0);
  });

  it("downgrades from good to acceptable on 30% prompt divergence", () => {
    const a = assessReport(baseReport({
      originalPerplexity: { perplexity: 7.0, raw: "" },
      compressedPerplexity: { perplexity: 7.4, raw: "" }, // good
      battery: { total: 10, matching: 7, diverged: 3, details: [] }, // 30%
    }));
    expect(a.verdict).toBe("acceptable");
  });

  it("includes size and speed bullets in the summary", () => {
    const a = assessReport(baseReport());
    const text = a.bullets.join(" ");
    expect(text).toMatch(/Size reduced/i);
    expect(text).toMatch(/speed/i);
  });
});
