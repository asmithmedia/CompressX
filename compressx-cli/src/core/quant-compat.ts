/**
 * Quantization compatibility logic for the hybrid compress path.
 *
 * The hybrid approach uses the user's locally-installed GGUF file as the
 * compression source when possible, falling back to downloading original
 * weights from HuggingFace when necessary. This module decides when the
 * local path is safe to use, when it requires a warning, and when it's
 * impossible.
 *
 * Key rules:
 *   - You can only re-quantize to EQUAL or SMALLER bits-per-weight. You
 *     can't recover information that was already thrown away — going from
 *     Q4_K_M back up to Q8_0 requires the original FP16 weights.
 *   - Re-quantization compounds quality loss. FP16 -> Q4_K_M -> Q2_K is
 *     ~2-3% worse than the direct FP16 -> Q2_K path. For most users this
 *     is imperceptible, but aggressive jumps should carry a warning.
 */

/** Bits-per-weight for each quant format we support. */
export const BITS_PER_WEIGHT: Record<string, number> = {
  f16: 16.0,
  f32: 32.0,
  q8_0: 8.5,
  q6_k: 6.6,
  q5_k_m: 5.7,
  q5_k_s: 5.5,
  q5_0: 5.5,
  q4_k_m: 4.9,
  q4_k_s: 4.6,
  q4_0: 4.5,
  q3_k_m: 3.9,
  q3_k_s: 3.5,
  q3_k_l: 4.3,
  q2_k: 3.35,
  iq2_xxs: 2.06,
  iq2_xs: 2.31,
};

export type RequantDecision =
  | { kind: "ok" }
  | { kind: "warn"; message: string }
  | { kind: "strong-warn"; message: string }
  | { kind: "impossible"; reason: string };

/**
 * Decide whether re-quantizing from sourceQuant to targetQuant via the
 * local GGUF path is safe, requires a warning, or is flat-out impossible.
 *
 * Returns one of four states:
 *   - "ok": the jump is small/equal, proceed without a warning
 *   - "warn": noticeable compounding loss, show a gentle note
 *   - "strong-warn": aggressive jump, show a prominent warning
 *   - "impossible": target has equal or higher precision than source,
 *     can't be done without the original weights
 */
export function canRequantize(sourceQuant: string, targetQuant: string): RequantDecision {
  const sourceBpw = BITS_PER_WEIGHT[sourceQuant.toLowerCase()];
  const targetBpw = BITS_PER_WEIGHT[targetQuant.toLowerCase()];

  // Unknown quants -> treat as impossible so we fall back to the HF path
  if (sourceBpw === undefined || targetBpw === undefined) {
    return {
      kind: "impossible",
      reason: `unknown quant format (source=${sourceQuant}, target=${targetQuant})`,
    };
  }

  // Target equal to or larger than source -> can't upgrade quality locally
  if (targetBpw >= sourceBpw) {
    return {
      kind: "impossible",
      reason: `cannot upgrade quality from ${sourceQuant.toUpperCase()} to ${targetQuant.toUpperCase()} without the original weights (would need ${targetBpw} bpw, source is ${sourceBpw} bpw)`,
    };
  }

  // Ratio of how much precision we're keeping vs dropping.
  // 1.0 = same, 0.5 = half the bits, 0.2 = very aggressive
  const ratio = targetBpw / sourceBpw;

  if (ratio >= 0.9) {
    // Nearly identical (e.g. Q4_K_M -> Q4_0) — quality loss negligible
    return { kind: "ok" };
  }

  if (ratio >= 0.75) {
    // Modest jump (e.g. Q4_K_M -> Q3_K_M) — small but measurable loss
    return {
      kind: "warn",
      message: `Re-quantizing from ${sourceQuant.toUpperCase()} to ${targetQuant.toUpperCase()}. Quality loss will be minor but measurable. For pristine quality, use --from-source (downloads original weights).`,
    };
  }

  // Aggressive jump (e.g. Q4_K_M -> Q2_K) — noticeable loss likely
  return {
    kind: "strong-warn",
    message: `AGGRESSIVE re-quantization from ${sourceQuant.toUpperCase()} to ${targetQuant.toUpperCase()}. Compounding quality loss from double-quantization will be noticeable on reasoning and math tasks. For best quality, use --from-source to re-download the original weights.`,
  };
}

/**
 * Normalize a quant level string to the form used as keys in BITS_PER_WEIGHT.
 * Ollama reports them in various forms: "Q4_K_M", "Q4_0", "F16", etc.
 */
export function normalizeQuant(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (lower === "unknown" || lower === "") return null;
  if (BITS_PER_WEIGHT[lower] !== undefined) return lower;
  return null;
}
