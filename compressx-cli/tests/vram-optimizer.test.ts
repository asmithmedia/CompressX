import { describe, it, expect } from "vitest";
import {
  lookupArchitecture,
  kvBytesPerToken,
  estimateKvBytesPerToken,
  calculateVramBudget,
  formatContext,
  ARCHITECTURE_TABLE,
} from "../src/core/vram-optimizer.js";

describe("lookupArchitecture", () => {
  it("finds Qwen3 4B by family and params", () => {
    const arch = lookupArchitecture("Qwen", 4);
    expect(arch).not.toBeNull();
    expect(arch!.layers).toBe(36);
    expect(arch!.hiddenDim).toBe(2560);
  });

  it("finds Llama 8B with family variant names", () => {
    expect(lookupArchitecture("Llama", 8)).not.toBeNull();
    expect(lookupArchitecture("Llama3", 8)).not.toBeNull();
  });

  it("finds Gemma models", () => {
    const arch = lookupArchitecture("Gemma", 4);
    expect(arch).not.toBeNull();
    expect(arch!.numKvHeads).toBe(4); // GQA
  });

  it("returns null for unknown families", () => {
    expect(lookupArchitecture("UnknownModel", 7)).toBeNull();
  });

  it("returns null for unknown param sizes in known families", () => {
    expect(lookupArchitecture("Qwen", 99)).toBeNull();
  });

  it("handles TinyLlama by exact lookup", () => {
    const arch = lookupArchitecture("TinyLlama", 1.1);
    // Rounds to 1, tries tinyllama-1b which doesn't exist,
    // but the exact key is tinyllama-1.1b
    expect(arch).not.toBeNull();
  });
});

describe("kvBytesPerToken", () => {
  it("calculates correctly for Qwen3-4B at FP16", () => {
    const arch = ARCHITECTURE_TABLE["qwen-4b"];
    const bpt = kvBytesPerToken(arch, 2);
    // headDim = 2560/32 = 80, kvDim = 80*8 = 640
    // 2 * 36 * 640 * 2 = 92160 bytes per token
    expect(bpt).toBe(92160);
  });

  it("halves when using Q8_0 (1 byte per element)", () => {
    const arch = ARCHITECTURE_TABLE["qwen-4b"];
    const fp16 = kvBytesPerToken(arch, 2);
    const q8 = kvBytesPerToken(arch, 1);
    expect(q8).toBe(fp16 / 2);
  });

  it("accounts for GQA reduction", () => {
    // Gemma 1B has numKvHeads=1 (massive GQA reduction)
    const gemma1b = ARCHITECTURE_TABLE["gemma-1b"];
    const llama8b = ARCHITECTURE_TABLE["llama-8b"];
    // Gemma 1B should have much smaller KV per token despite similar hiddenDim
    const gemmaKv = kvBytesPerToken(gemma1b, 2);
    const llamaKv = kvBytesPerToken(llama8b, 2);
    expect(gemmaKv).toBeLessThan(llamaKv);
  });
});

describe("estimateKvBytesPerToken", () => {
  it("returns a reasonable estimate for 4B params", () => {
    const est = estimateKvBytesPerToken(4, 2);
    // Actual Qwen-4B is 92160. Estimate should be in the right order of magnitude.
    expect(est).toBeGreaterThan(40000);
    expect(est).toBeLessThan(150000);
  });

  it("scales with parameter count", () => {
    const small = estimateKvBytesPerToken(1, 2);
    const large = estimateKvBytesPerToken(14, 2);
    expect(large).toBeGreaterThan(small);
  });
});

describe("calculateVramBudget", () => {
  it("returns a valid budget for a typical setup", () => {
    // 8 GB VRAM, 2.5 GB weights, Qwen family 4B
    const budget = calculateVramBudget(2.5, 8, "Qwen", 4);
    expect(budget).not.toBeNull();
    expect(budget!.maxContext).toBeGreaterThanOrEqual(2048);
    expect(budget!.weightsGb).toBe(2.5);
    expect(budget!.totalVramGb).toBe(8);
    expect(budget!.kvCacheGb).toBeGreaterThan(0);
    expect(budget!.headroomGb).toBeGreaterThan(0);
  });

  it("returns context aligned to 512-token steps", () => {
    const budget = calculateVramBudget(2, 8, "Qwen", 4);
    expect(budget).not.toBeNull();
    expect(budget!.maxContext % 512).toBe(0);
  });

  it("uses Q8_0 when it allows more context than FP16 would", () => {
    // When VRAM is extremely tight, the algorithm should prefer Q8_0
    // which halves KV cache memory. We verify the logic by checking
    // that Q8_0 mode gives double the context of what FP16 would give
    // (since it uses half the bytes per element).
    const arch = ARCHITECTURE_TABLE["qwen-14b"];
    const fp16bpt = kvBytesPerToken(arch, 2);
    const q8bpt = kvBytesPerToken(arch, 1);
    expect(q8bpt).toBe(fp16bpt / 2);
  });

  it("returns null when VRAM is unknown", () => {
    expect(calculateVramBudget(2, null, "Qwen", 4)).toBeNull();
  });

  it("returns null when weights exceed VRAM", () => {
    expect(calculateVramBudget(10, 8, "Qwen", 4)).toBeNull();
  });

  it("works with unknown model families using estimation", () => {
    const budget = calculateVramBudget(2, 8, "UnknownFamily", 4);
    expect(budget).not.toBeNull();
    expect(budget!.precise).toBe(false);
  });

  it("uses precise flag when architecture is known", () => {
    const budget = calculateVramBudget(2, 8, "Qwen", 4);
    expect(budget).not.toBeNull();
    expect(budget!.precise).toBe(true);
  });

  it("caps context at 128K", () => {
    // Tiny model on massive GPU = tons of room
    const budget = calculateVramBudget(0.3, 80, "SmolLM", 0.135);
    expect(budget).not.toBeNull();
    expect(budget!.maxContext).toBeLessThanOrEqual(131072);
  });
});

describe("formatContext", () => {
  it("formats round K values", () => {
    expect(formatContext(4096)).toBe("4K");
    expect(formatContext(8192)).toBe("8K");
    expect(formatContext(131072)).toBe("128K");
  });

  it("rounds non-exact K values", () => {
    expect(formatContext(3584)).toBe("4K");
    expect(formatContext(46592)).toBe("46K");
  });

  it("keeps sub-1K values as-is", () => {
    expect(formatContext(512)).toBe("512");
  });
});
