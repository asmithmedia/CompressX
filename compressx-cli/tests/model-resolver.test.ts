import { describe, it, expect } from "vitest";
import {
  resolveModel,
  parseParameterCount,
  recommendQuantType,
  MODEL_MAP,
} from "../src/core/model-resolver.js";

describe("parseParameterCount", () => {
  it("parses billion suffix (lowercase)", () => {
    expect(parseParameterCount("qwen3:4b")).toBe(4);
    expect(parseParameterCount("llama3.1:70b")).toBe(70);
  });

  it("parses billion suffix with decimal", () => {
    expect(parseParameterCount("tinyllama:1.1b")).toBe(1.1);
    expect(parseParameterCount("smollm2:1.7b")).toBe(1.7);
  });

  it("parses million suffix", () => {
    expect(parseParameterCount("smollm2:135m")).toBe(0.135);
    expect(parseParameterCount("smollm2:360m")).toBe(0.36);
  });

  it("parses MoE notation as total params", () => {
    // Mixtral 8x7B is ~46.7B total (not 56). Convention uses ~0.84 multiplier.
    const result = parseParameterCount("mixtral:8x7b");
    expect(result).toBeGreaterThan(40);
    expect(result).toBeLessThan(60);
  });

  it("returns null for non-size tags", () => {
    expect(parseParameterCount("phi3:mini")).toBeNull();
    expect(parseParameterCount("gemma3:latest")).toBeNull();
    expect(parseParameterCount("model:cloud")).toBeNull();
  });

  it("handles model names without tags", () => {
    expect(parseParameterCount("qwen3")).toBeNull();
  });
});

describe("resolveModel", () => {
  it("returns exact registry matches without synthetic flag", () => {
    const r = resolveModel("qwen3:4b");
    expect(r).not.toBeNull();
    expect(r!.name).toBe("Qwen 3 4B");
    expect(r!.synthetic).toBeFalsy();
    expect(r!.hfRepoId).toBe("Qwen/Qwen3-4B");
  });

  it("falls back to synthetic for unknown models with size tags", () => {
    const r = resolveModel("gemma4:12b");
    expect(r).not.toBeNull();
    expect(r!.synthetic).toBe(true);
    expect(r!.parametersBillion).toBe(12);
    expect(r!.family).toBe("Gemma4");
  });

  it("creates synthetic entry for HuggingFace repos with size in name", () => {
    const r = resolveModel("Qwen/Qwen3-14B");
    expect(r).not.toBeNull();
    expect(r!.hfRepoId).toBe("Qwen/Qwen3-14B");
    expect(r!.synthetic).toBe(true);
    expect(r!.parametersBillion).toBe(14);
  });

  it("returns null for unknown models without size hints", () => {
    expect(resolveModel("totally-unknown-model")).toBeNull();
    expect(resolveModel("some-cloud-model:latest")).toBeNull();
  });

  it("has at least 40 models in the curated registry", () => {
    // Guard against accidental regression in model coverage
    expect(Object.keys(MODEL_MAP).length).toBeGreaterThanOrEqual(40);
  });

  it("every registry entry has a real HuggingFace repo id", () => {
    for (const [key, model] of Object.entries(MODEL_MAP)) {
      expect(model.hfRepoId, `${key} missing hfRepoId`).toMatch(/.+\/.+/);
      expect(model.parametersBillion, `${key} missing params`).toBeGreaterThan(0);
    }
  });
});

describe("recommendQuantType", () => {
  it("recommends Q8_0 for a tiny model on big hardware", () => {
    const r = recommendQuantType(1.1, 100);
    expect(r.quantType).toBe("q8_0");
  });

  it("drops to smaller quants when hardware is constrained", () => {
    const r = recommendQuantType(14, 6);
    // 14B at q8_0 is ~15 GB, at q4_k_m is ~9 GB, at q3_k_m is ~7 GB
    // On 6 GB we need q2_k
    expect(r.quantType).toBe("q2_k");
  });

  it("returns the tightest fit when nothing fits", () => {
    const r = recommendQuantType(70, 4);
    // Nothing fits but we return q2_k as the best attempt
    expect(r.quantType).toBe("q2_k");
    expect(r.label).toContain("may not fit");
  });

  it("estimated size is reasonable for a known case", () => {
    // 4B at q5_k_m should be around 2.9 GB — use a 4 GB budget so the
    // recommender drops below q8_0 (which would otherwise fit at ~4.35 GB).
    const r = recommendQuantType(4, 4);
    expect(r.estimatedSizeGb).toBeGreaterThan(2);
    expect(r.estimatedSizeGb).toBeLessThan(4);
  });
});
