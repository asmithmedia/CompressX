import { describe, it, expect } from "vitest";
import {
  canRequantize,
  normalizeQuant,
  BITS_PER_WEIGHT,
} from "../src/core/quant-compat.js";

describe("canRequantize", () => {
  it("rejects upgrades (target precision higher than source)", () => {
    const r = canRequantize("q4_k_m", "q8_0");
    expect(r.kind).toBe("impossible");
  });

  it("rejects same-precision requantization as impossible", () => {
    // Q4_K_M to Q4_K_M is a no-op and target is not strictly smaller
    const r = canRequantize("q4_k_m", "q4_k_m");
    expect(r.kind).toBe("impossible");
  });

  it("allows small downward jumps without warning", () => {
    // Q4_K_M -> Q4_0 is nearly identical BPW
    const r = canRequantize("q4_k_m", "q4_0");
    expect(r.kind).toBe("ok");
  });

  it("warns on modest jumps", () => {
    // Q4_K_M -> Q3_K_M is measurable but not severe
    const r = canRequantize("q4_k_m", "q3_k_m");
    expect(r.kind).toBe("warn");
    if (r.kind === "warn") {
      expect(r.message).toContain("minor");
    }
  });

  it("strong-warns on aggressive jumps", () => {
    // Q4_K_M -> Q2_K is the classic "breaks reasoning" jump
    const r = canRequantize("q4_k_m", "q2_k");
    expect(r.kind).toBe("strong-warn");
    if (r.kind === "strong-warn") {
      expect(r.message).toContain("AGGRESSIVE");
    }
  });

  it("rejects unknown quant formats as impossible", () => {
    const r = canRequantize("q9001", "q2_k");
    expect(r.kind).toBe("impossible");
  });

  it("allows Q8_0 down to smaller quants (conservatively)", () => {
    // Q8_0 -> Q4_K_M is a ratio of ~0.58, which our module treats as a
    // strong warning — the double-quantization compounds on reasoning tasks.
    expect(canRequantize("q8_0", "q4_k_m").kind).toBe("strong-warn");
    expect(canRequantize("q8_0", "q2_k").kind).toBe("strong-warn");
    // Q8_0 -> Q6_K is a smaller jump (ratio ~0.78) -> gentle warn.
    expect(canRequantize("q8_0", "q6_k").kind).toBe("warn");
  });
});

describe("normalizeQuant", () => {
  it("lowercases and matches known quants", () => {
    expect(normalizeQuant("Q4_K_M")).toBe("q4_k_m");
    expect(normalizeQuant("q8_0")).toBe("q8_0");
    expect(normalizeQuant("F16")).toBe("f16");
  });

  it("returns null for unknowns", () => {
    expect(normalizeQuant("unknown")).toBeNull();
    expect(normalizeQuant("")).toBeNull();
    expect(normalizeQuant(null)).toBeNull();
    expect(normalizeQuant(undefined)).toBeNull();
  });
});

describe("BITS_PER_WEIGHT table", () => {
  it("has monotonically decreasing BPW from f16 down to q2_k", () => {
    expect(BITS_PER_WEIGHT.f16).toBeGreaterThan(BITS_PER_WEIGHT.q8_0);
    expect(BITS_PER_WEIGHT.q8_0).toBeGreaterThan(BITS_PER_WEIGHT.q6_k);
    expect(BITS_PER_WEIGHT.q6_k).toBeGreaterThan(BITS_PER_WEIGHT.q5_k_m);
    expect(BITS_PER_WEIGHT.q5_k_m).toBeGreaterThan(BITS_PER_WEIGHT.q4_k_m);
    expect(BITS_PER_WEIGHT.q4_k_m).toBeGreaterThan(BITS_PER_WEIGHT.q3_k_m);
    expect(BITS_PER_WEIGHT.q3_k_m).toBeGreaterThan(BITS_PER_WEIGHT.q2_k);
  });
});
