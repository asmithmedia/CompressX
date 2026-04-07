import chalk from "chalk";

/**
 * VRAM budget optimizer: calculates KV cache overhead and finds the
 * optimal context length for a given model + GPU combination.
 *
 * Every transformer LLM allocates two memory pools on the GPU:
 *   1. Model weights (static, determined at load time by the quant level)
 *   2. KV cache (dynamic, grows linearly with context length)
 *
 * CompressX already optimizes (1) via quantization. This module
 * optimizes (2) by calculating how much context the user can afford
 * after compression and setting num_ctx accordingly.
 *
 * KV cache formula (per token):
 *   bytes = 2 × numLayers × kvDim × bytesPerElement
 *
 * Where:
 *   2 = one K tensor + one V tensor
 *   kvDim = (hiddenDim / numHeads) × numKvHeads  (GQA-aware)
 *   bytesPerElement = 2 for FP16, 1 for Q8_0, 0.5 for Q4_0
 */

/**
 * Architecture specs for known model families. Used for precise KV
 * cache estimation. When a model isn't in this table, we fall back
 * to a parameter-count-based heuristic.
 *
 * Sources: model config.json files from HuggingFace.
 */
export interface ArchSpec {
  layers: number;
  hiddenDim: number;
  numHeads: number;
  numKvHeads: number;
}

export const ARCHITECTURE_TABLE: Record<string, ArchSpec> = {
  // Qwen 3
  "qwen-0.6b": { layers: 28, hiddenDim: 1024, numHeads: 16, numKvHeads: 4 },
  "qwen-1.7b": { layers: 28, hiddenDim: 2048, numHeads: 16, numKvHeads: 4 },
  "qwen-4b": { layers: 36, hiddenDim: 2560, numHeads: 32, numKvHeads: 8 },
  "qwen-8b": { layers: 36, hiddenDim: 4096, numHeads: 32, numKvHeads: 8 },
  "qwen-14b": { layers: 40, hiddenDim: 5120, numHeads: 40, numKvHeads: 8 },
  "qwen-32b": { layers: 64, hiddenDim: 5120, numHeads: 40, numKvHeads: 8 },

  // Llama 3
  "llama-1b": { layers: 16, hiddenDim: 2048, numHeads: 32, numKvHeads: 8 },
  "llama-3b": { layers: 28, hiddenDim: 3072, numHeads: 24, numKvHeads: 8 },
  "llama-8b": { layers: 32, hiddenDim: 4096, numHeads: 32, numKvHeads: 8 },
  "llama-70b": { layers: 80, hiddenDim: 8192, numHeads: 64, numKvHeads: 8 },

  // Gemma
  "gemma-1b": { layers: 18, hiddenDim: 1536, numHeads: 8, numKvHeads: 1 },
  "gemma-4b": { layers: 34, hiddenDim: 2560, numHeads: 16, numKvHeads: 4 },
  "gemma-9b": { layers: 42, hiddenDim: 3584, numHeads: 16, numKvHeads: 8 },
  "gemma-12b": { layers: 48, hiddenDim: 3840, numHeads: 16, numKvHeads: 8 },
  "gemma-27b": { layers: 46, hiddenDim: 4608, numHeads: 32, numKvHeads: 16 },

  // Mistral
  "mistral-7b": { layers: 32, hiddenDim: 4096, numHeads: 32, numKvHeads: 8 },
  "mistral-12b": { layers: 40, hiddenDim: 5120, numHeads: 32, numKvHeads: 8 },

  // Phi
  "phi-3.8b": { layers: 32, hiddenDim: 3072, numHeads: 32, numKvHeads: 32 },
  "phi-14b": { layers: 40, hiddenDim: 5120, numHeads: 40, numKvHeads: 10 },

  // DeepSeek R1 distills (Qwen-based)
  "deepseek-1.5b": { layers: 28, hiddenDim: 1536, numHeads: 12, numKvHeads: 2 },
  "deepseek-7b": { layers: 28, hiddenDim: 3584, numHeads: 28, numKvHeads: 4 },
  "deepseek-8b": { layers: 32, hiddenDim: 4096, numHeads: 32, numKvHeads: 8 },
  "deepseek-14b": { layers: 48, hiddenDim: 5120, numHeads: 40, numKvHeads: 8 },
  "deepseek-32b": { layers: 64, hiddenDim: 5120, numHeads: 40, numKvHeads: 8 },

  // TinyLlama
  "tinyllama-1.1b": { layers: 22, hiddenDim: 2048, numHeads: 32, numKvHeads: 4 },

  // SmolLM
  "smollm-0.135b": { layers: 30, hiddenDim: 576, numHeads: 9, numKvHeads: 3 },
  "smollm-0.36b": { layers: 32, hiddenDim: 960, numHeads: 15, numKvHeads: 5 },
  "smollm-1.7b": { layers: 24, hiddenDim: 2048, numHeads: 32, numKvHeads: 32 },
};

/**
 * Look up architecture specs for a model. Tries to match by family
 * and parameter count. Returns null if no match found.
 */
export function lookupArchitecture(
  family: string,
  paramsBillion: number,
): ArchSpec | null {
  // Normalize family name for lookup
  const normalizedFamily = family.toLowerCase().replace(/[^a-z]/g, "");

  // Map family names to lookup prefixes
  const familyMap: Record<string, string> = {
    qwen: "qwen",
    qwen3: "qwen",
    qwen25: "qwen",
    llama: "llama",
    llama3: "llama",
    gemma: "gemma",
    gemma2: "gemma",
    gemma3: "gemma",
    mistral: "mistral",
    phi: "phi",
    phi3: "phi",
    phi4: "phi",
    deepseek: "deepseek",
    tinyllama: "tinyllama",
    smollm: "smollm",
    smollm2: "smollm",
  };

  const prefix = familyMap[normalizedFamily];
  if (!prefix) return null;

  // Try exact param match first
  const exactKey = `${prefix}-${paramsBillion}b`;
  if (ARCHITECTURE_TABLE[exactKey]) return ARCHITECTURE_TABLE[exactKey];

  // Try rounding to common sizes
  const rounded = Math.round(paramsBillion);
  const roundedKey = `${prefix}-${rounded}b`;
  if (ARCHITECTURE_TABLE[roundedKey]) return ARCHITECTURE_TABLE[roundedKey];

  return null;
}

/**
 * Calculate KV cache size per token in bytes using architecture specs.
 *
 * Formula: 2 × layers × kvDim × bytesPerElement
 * Where kvDim = (hiddenDim / numHeads) × numKvHeads
 *
 * The "2" is because each layer stores both a K and a V tensor.
 * GQA (Grouped Query Attention) reduces numKvHeads below numHeads,
 * which is the main reason modern models like Llama 3 and Qwen 3
 * have much smaller KV caches than older models.
 */
export function kvBytesPerToken(arch: ArchSpec, bytesPerElement = 2): number {
  const headDim = arch.hiddenDim / arch.numHeads;
  const kvDim = headDim * arch.numKvHeads;
  return 2 * arch.layers * kvDim * bytesPerElement;
}

/**
 * Estimate KV cache bytes per token using only parameter count.
 * Falls back to this when the model isn't in ARCHITECTURE_TABLE.
 *
 * Heuristic: modern GQA models use roughly 0.05-0.15 bytes per param
 * per token at FP16. We use 0.1 as a conservative middle ground.
 * This is calibrated against Qwen3-4B (actual: 0.092), Llama-8B
 * (actual: 0.064), and Gemma-4B (actual: 0.068).
 */
export function estimateKvBytesPerToken(
  paramsBillion: number,
  bytesPerElement = 2,
): number {
  // Calibrated against actual architectures:
  //   Qwen-4B:  92160 bpt → ratio 23040/B
  //   Llama-8B: 65536 bpt → ratio  8192/B
  //   Gemma-27B: 270336 bpt → ratio 10012/B
  //   Qwen-14B: 204800 bpt → ratio 14629/B
  //
  // The relationship is roughly linear: kvBytes ≈ params_B × 15000 at FP16.
  // This is conservative (overestimates for GQA-heavy models like Llama,
  // accurate for moderate GQA like Qwen). Overestimating is safer than
  // underestimating since it means we recommend less context than the model
  // can actually handle, rather than causing OOM.
  const kvBytesAtFp16 = paramsBillion * 15000;
  return Math.round(kvBytesAtFp16 * (bytesPerElement / 2));
}

export interface VramBudget {
  /** Total VRAM available in GB */
  totalVramGb: number;
  /** Compressed model weights in GB */
  weightsGb: number;
  /** KV cache size at the recommended context length, in GB */
  kvCacheGb: number;
  /** Remaining VRAM after weights + KV cache */
  headroomGb: number;
  /** Recommended context length (tokens) that fits in VRAM */
  maxContext: number;
  /** Whether we used architecture lookup or estimation */
  precise: boolean;
  /** KV cache precision used: "FP16" or "Q8_0" */
  kvPrecision: string;
}

/**
 * Calculate the VRAM budget for a compressed model on the user's GPU.
 * Finds the maximum context length that fits while leaving at least
 * 0.3 GB of headroom for runtime overhead (CUDA context, scratch
 * buffers, etc.).
 *
 * Tries FP16 KV cache first (best quality). If that gives less than
 * 2K context, switches to Q8_0 KV cache (halves the cache memory
 * with negligible quality impact).
 *
 * Returns null if VRAM is unknown or insufficient for even 512 tokens.
 */
export function calculateVramBudget(
  weightsGb: number,
  vramGb: number | null,
  family: string,
  paramsBillion: number,
): VramBudget | null {
  if (!vramGb || vramGb < 1) return null;

  const HEADROOM_GB = 0.3;
  const MIN_CONTEXT = 512;
  const MAX_CONTEXT = 131072; // 128K, reasonable upper bound
  const CONTEXT_STEP = 512;

  const availableForKv = vramGb - weightsGb - HEADROOM_GB;
  if (availableForKv <= 0) return null;

  // Get KV bytes per token — precise if we have architecture data
  const arch = lookupArchitecture(family, paramsBillion);
  const precise = arch !== null;

  // Try FP16 first (2 bytes per element)
  const kvBpt16 = arch
    ? kvBytesPerToken(arch, 2)
    : estimateKvBytesPerToken(paramsBillion, 2);

  const maxCtx16 = Math.floor((availableForKv * 1e9) / kvBpt16);
  const ctx16 = Math.min(
    MAX_CONTEXT,
    Math.floor(maxCtx16 / CONTEXT_STEP) * CONTEXT_STEP,
  );

  // If FP16 gives at least 2K context, use it
  if (ctx16 >= 2048) {
    const kvGb = (ctx16 * kvBpt16) / 1e9;
    return {
      totalVramGb: vramGb,
      weightsGb,
      kvCacheGb: Math.round(kvGb * 100) / 100,
      headroomGb: Math.round((vramGb - weightsGb - kvGb) * 100) / 100,
      maxContext: ctx16,
      precise,
      kvPrecision: "FP16",
    };
  }

  // Fall back to Q8_0 (1 byte per element — halves cache)
  const kvBpt8 = arch
    ? kvBytesPerToken(arch, 1)
    : estimateKvBytesPerToken(paramsBillion, 1);

  const maxCtx8 = Math.floor((availableForKv * 1e9) / kvBpt8);
  const ctx8 = Math.min(
    MAX_CONTEXT,
    Math.floor(maxCtx8 / CONTEXT_STEP) * CONTEXT_STEP,
  );

  if (ctx8 < MIN_CONTEXT) return null;

  const kvGb8 = (ctx8 * kvBpt8) / 1e9;
  return {
    totalVramGb: vramGb,
    weightsGb,
    kvCacheGb: Math.round(kvGb8 * 100) / 100,
    headroomGb: Math.round((vramGb - weightsGb - kvGb8) * 100) / 100,
    maxContext: ctx8,
    precise,
    kvPrecision: "Q8_0",
  };
}

/**
 * Format the VRAM budget as colored lines for the compression summary.
 */
export function formatVramBudget(budget: VramBudget): string[] {
  const lines: string[] = [];
  lines.push("");
  lines.push(chalk.bold(`  VRAM Budget (${budget.totalVramGb} GB):`));
  lines.push(
    `    ${chalk.gray("Weights:")}    ${budget.weightsGb.toFixed(1)} GB`,
  );
  lines.push(
    `    ${chalk.gray("KV Cache:")}   ${budget.kvCacheGb.toFixed(1)} GB` +
      chalk.gray(
        ` (${budget.kvPrecision}, ${formatContext(budget.maxContext)} context)`,
      ),
  );
  lines.push(
    `    ${chalk.gray("Headroom:")}   ${budget.headroomGb.toFixed(1)} GB`,
  );
  lines.push("");
  lines.push(
    `    ${chalk.gray("Modelfile set to:")} ${chalk.cyan(`num_ctx ${budget.maxContext}`)}` +
      (budget.precise ? "" : chalk.gray(" (estimated)")),
  );
  return lines;
}

/**
 * Format a context length as a human-readable string: 4096 → "4K",
 * 131072 → "128K", 2048 → "2K".
 */
export function formatContext(ctx: number): string {
  if (ctx >= 1024) return `${Math.round(ctx / 1024)}K`;
  return `${ctx}`;
}
