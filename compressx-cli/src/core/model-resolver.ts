export interface ResolvedModel {
  ollamaId: string;
  name: string;
  hfRepoId: string;
  parametersBillion: number;
  fp16SizeGb: number;
  family: string;
  description: string;
  /** Highlighted in `compressx models --featured` */
  featured?: boolean;
  /** True when this result came from a fallback (parsing, HF API, user repo), not the curated registry */
  synthetic?: boolean;
}

/**
 * Curated registry of models we know how to resolve cleanly:
 * authoritative HuggingFace repo, canonical family name, tagged size.
 *
 * For everything else we fall back to name parsing or HuggingFace API
 * search so users aren't blocked by the registry being incomplete.
 */
export const MODEL_MAP: Record<string, ResolvedModel> = {
  // Qwen 3 family
  "qwen3:0.6b":  { ollamaId: "qwen3:0.6b",  name: "Qwen 3 0.6B",  hfRepoId: "Qwen/Qwen3-0.6B",  parametersBillion: 0.6, fp16SizeGb: 1.2,  family: "Qwen", description: "Ultra-lightweight" },
  "qwen3:1.7b":  { ollamaId: "qwen3:1.7b",  name: "Qwen 3 1.7B",  hfRepoId: "Qwen/Qwen3-1.7B",  parametersBillion: 1.7, fp16SizeGb: 3.4,  family: "Qwen", description: "Compact" },
  "qwen3:4b":    { ollamaId: "qwen3:4b",    name: "Qwen 3 4B",    hfRepoId: "Qwen/Qwen3-4B",    parametersBillion: 4,   fp16SizeGb: 8,    family: "Qwen", description: "Balanced", featured: true },
  "qwen3:8b":    { ollamaId: "qwen3:8b",    name: "Qwen 3 8B",    hfRepoId: "Qwen/Qwen3-8B",    parametersBillion: 8,   fp16SizeGb: 16,   family: "Qwen", description: "General-purpose", featured: true },
  "qwen3:14b":   { ollamaId: "qwen3:14b",   name: "Qwen 3 14B",   hfRepoId: "Qwen/Qwen3-14B",   parametersBillion: 14,  fp16SizeGb: 28,   family: "Qwen", description: "High-quality" },
  "qwen3:32b":   { ollamaId: "qwen3:32b",   name: "Qwen 3 32B",   hfRepoId: "Qwen/Qwen3-32B",   parametersBillion: 32,  fp16SizeGb: 64,   family: "Qwen", description: "Near-frontier" },

  // Qwen 2.5 Coder
  "qwen2.5-coder:1.5b": { ollamaId: "qwen2.5-coder:1.5b", name: "Qwen2.5 Coder 1.5B", hfRepoId: "Qwen/Qwen2.5-Coder-1.5B-Instruct", parametersBillion: 1.5, fp16SizeGb: 3,  family: "Qwen", description: "Code-specialized, tiny" },
  "qwen2.5-coder:7b":   { ollamaId: "qwen2.5-coder:7b",   name: "Qwen2.5 Coder 7B",   hfRepoId: "Qwen/Qwen2.5-Coder-7B-Instruct",   parametersBillion: 7,   fp16SizeGb: 14, family: "Qwen", description: "Code-specialized", featured: true },
  "qwen2.5-coder:14b":  { ollamaId: "qwen2.5-coder:14b",  name: "Qwen2.5 Coder 14B",  hfRepoId: "Qwen/Qwen2.5-Coder-14B-Instruct",  parametersBillion: 14,  fp16SizeGb: 28, family: "Qwen", description: "Code-specialized, high quality" },
  "qwen2.5-coder:32b":  { ollamaId: "qwen2.5-coder:32b",  name: "Qwen2.5 Coder 32B",  hfRepoId: "Qwen/Qwen2.5-Coder-32B-Instruct",  parametersBillion: 32,  fp16SizeGb: 64, family: "Qwen", description: "Code-specialized, frontier" },

  // Qwen 3 Coder
  "qwen3-coder:30b": { ollamaId: "qwen3-coder:30b", name: "Qwen 3 Coder 30B", hfRepoId: "Qwen/Qwen3-Coder-30B-A3B-Instruct", parametersBillion: 30, fp16SizeGb: 60, family: "Qwen", description: "Latest code specialist" },

  // Gemma 3
  "gemma3:1b":   { ollamaId: "gemma3:1b",   name: "Gemma 3 1B",  hfRepoId: "google/gemma-3-1b-pt",  parametersBillion: 1,  fp16SizeGb: 2,   family: "Gemma", description: "Ultra-light" },
  "gemma3:4b":   { ollamaId: "gemma3:4b",   name: "Gemma 3 4B",  hfRepoId: "google/gemma-3-4b-pt",  parametersBillion: 4,  fp16SizeGb: 8,   family: "Gemma", description: "Efficient", featured: true },
  "gemma3:12b":  { ollamaId: "gemma3:12b",  name: "Gemma 3 12B", hfRepoId: "google/gemma-3-12b-pt", parametersBillion: 12, fp16SizeGb: 24,  family: "Gemma", description: "Strong reasoning" },
  "gemma3:27b":  { ollamaId: "gemma3:27b",  name: "Gemma 3 27B", hfRepoId: "google/gemma-3-27b-pt", parametersBillion: 27, fp16SizeGb: 54,  family: "Gemma", description: "Largest Gemma" },

  // Gemma 2
  "gemma2:2b":   { ollamaId: "gemma2:2b",   name: "Gemma 2 2B",  hfRepoId: "google/gemma-2-2b-it",  parametersBillion: 2,  fp16SizeGb: 4,   family: "Gemma", description: "Small chat" },
  "gemma2:9b":   { ollamaId: "gemma2:9b",   name: "Gemma 2 9B",  hfRepoId: "google/gemma-2-9b-it",  parametersBillion: 9,  fp16SizeGb: 18,  family: "Gemma", description: "Balanced chat" },
  "gemma2:27b":  { ollamaId: "gemma2:27b",  name: "Gemma 2 27B", hfRepoId: "google/gemma-2-27b-it", parametersBillion: 27, fp16SizeGb: 54,  family: "Gemma", description: "Flagship Gemma 2" },

  // Llama 3.1 / 3.2 / 3.3
  "llama3.2:1b":  { ollamaId: "llama3.2:1b",  name: "Llama 3.2 1B",  hfRepoId: "meta-llama/Llama-3.2-1B-Instruct",  parametersBillion: 1,  fp16SizeGb: 2.5, family: "Llama", description: "Edge-ready" },
  "llama3.2:3b":  { ollamaId: "llama3.2:3b",  name: "Llama 3.2 3B",  hfRepoId: "meta-llama/Llama-3.2-3B-Instruct",  parametersBillion: 3,  fp16SizeGb: 6.4, family: "Llama", description: "Compact chat", featured: true },
  "llama3.1:8b":  { ollamaId: "llama3.1:8b",  name: "Llama 3.1 8B",  hfRepoId: "meta-llama/Llama-3.1-8B-Instruct",  parametersBillion: 8,  fp16SizeGb: 16,  family: "Llama", description: "Popular general-purpose", featured: true },
  "llama3.1:70b": { ollamaId: "llama3.1:70b", name: "Llama 3.1 70B", hfRepoId: "meta-llama/Llama-3.1-70B-Instruct", parametersBillion: 70, fp16SizeGb: 140, family: "Llama", description: "Frontier" },
  "llama3.3:70b": { ollamaId: "llama3.3:70b", name: "Llama 3.3 70B", hfRepoId: "meta-llama/Llama-3.3-70B-Instruct", parametersBillion: 70, fp16SizeGb: 140, family: "Llama", description: "Latest 70B" },

  // Mistral / Mixtral
  "mistral:7b":     { ollamaId: "mistral:7b",     name: "Mistral 7B",        hfRepoId: "mistralai/Mistral-7B-Instruct-v0.3", parametersBillion: 7,    fp16SizeGb: 14.5, family: "Mistral", description: "Efficient European model", featured: true },
  "mixtral:8x7b":   { ollamaId: "mixtral:8x7b",   name: "Mixtral 8x7B",      hfRepoId: "mistralai/Mixtral-8x7B-Instruct-v0.1", parametersBillion: 46.7, fp16SizeGb: 93, family: "Mistral", description: "MoE, strong" },
  "mistral-nemo:12b": { ollamaId: "mistral-nemo:12b", name: "Mistral Nemo 12B", hfRepoId: "mistralai/Mistral-Nemo-Instruct-2407", parametersBillion: 12, fp16SizeGb: 24, family: "Mistral", description: "Nvidia collaboration" },

  // Phi
  "phi4:14b":   { ollamaId: "phi4:14b",   name: "Phi-4 14B",    hfRepoId: "microsoft/phi-4",             parametersBillion: 14,  fp16SizeGb: 28,  family: "Phi", description: "Microsoft reasoning", featured: true },
  "phi3:mini":  { ollamaId: "phi3:mini",  name: "Phi-3 Mini",   hfRepoId: "microsoft/Phi-3-mini-4k-instruct", parametersBillion: 3.8, fp16SizeGb: 7.6, family: "Phi", description: "Surprisingly capable" },
  "phi3:medium":{ ollamaId: "phi3:medium",name: "Phi-3 Medium", hfRepoId: "microsoft/Phi-3-medium-4k-instruct", parametersBillion: 14, fp16SizeGb: 28, family: "Phi", description: "Stronger Phi-3" },

  // DeepSeek
  "deepseek-r1:1.5b": { ollamaId: "deepseek-r1:1.5b", name: "DeepSeek R1 Distill 1.5B", hfRepoId: "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B", parametersBillion: 1.5, fp16SizeGb: 3,    family: "DeepSeek", description: "Tiny reasoning distill" },
  "deepseek-r1:7b":   { ollamaId: "deepseek-r1:7b",   name: "DeepSeek R1 Distill 7B",   hfRepoId: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",   parametersBillion: 7,   fp16SizeGb: 14,   family: "DeepSeek", description: "Compact reasoning" },
  "deepseek-r1:8b":   { ollamaId: "deepseek-r1:8b",   name: "DeepSeek R1 Distill 8B",   hfRepoId: "deepseek-ai/DeepSeek-R1-Distill-Llama-8B", parametersBillion: 8,   fp16SizeGb: 16,   family: "DeepSeek", description: "Llama-based reasoning distill", featured: true },
  "deepseek-r1:14b":  { ollamaId: "deepseek-r1:14b",  name: "DeepSeek R1 Distill 14B",  hfRepoId: "deepseek-ai/DeepSeek-R1-Distill-Qwen-14B",  parametersBillion: 14,  fp16SizeGb: 28,   family: "DeepSeek", description: "Balanced reasoning" },
  "deepseek-r1:32b":  { ollamaId: "deepseek-r1:32b",  name: "DeepSeek R1 Distill 32B",  hfRepoId: "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",  parametersBillion: 32,  fp16SizeGb: 64,   family: "DeepSeek", description: "Top reasoning distill" },
  "deepseek-coder-v2:16b": { ollamaId: "deepseek-coder-v2:16b", name: "DeepSeek Coder V2 16B", hfRepoId: "deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct", parametersBillion: 16, fp16SizeGb: 32, family: "DeepSeek", description: "MoE code specialist" },

  // Code specialists
  "codegemma:7b":       { ollamaId: "codegemma:7b",       name: "CodeGemma 7B",      hfRepoId: "google/codegemma-7b-it",          parametersBillion: 7,  fp16SizeGb: 14,  family: "Gemma", description: "Google code model" },
  "codellama:7b":       { ollamaId: "codellama:7b",       name: "Code Llama 7B",     hfRepoId: "codellama/CodeLlama-7b-Instruct-hf", parametersBillion: 7, fp16SizeGb: 14, family: "Llama", description: "Classic code model" },
  "codellama:13b":      { ollamaId: "codellama:13b",      name: "Code Llama 13B",    hfRepoId: "codellama/CodeLlama-13b-Instruct-hf", parametersBillion: 13, fp16SizeGb: 26, family: "Llama", description: "Larger Code Llama" },
  "starcoder2:7b":      { ollamaId: "starcoder2:7b",      name: "StarCoder 2 7B",    hfRepoId: "bigcode/starcoder2-7b",           parametersBillion: 7,  fp16SizeGb: 14,  family: "StarCoder", description: "Permissive code model" },
  "starcoder2:15b":     { ollamaId: "starcoder2:15b",     name: "StarCoder 2 15B",   hfRepoId: "bigcode/starcoder2-15b",          parametersBillion: 15, fp16SizeGb: 30,  family: "StarCoder", description: "Larger StarCoder" },

  // Other notables
  "tinyllama:1.1b": { ollamaId: "tinyllama:1.1b", name: "TinyLlama 1.1B", hfRepoId: "TinyLlama/TinyLlama-1.1B-Chat-v1.0", parametersBillion: 1.1, fp16SizeGb: 2.2, family: "Llama", description: "Testing / edge" },
  "smollm2:135m":   { ollamaId: "smollm2:135m",   name: "SmolLM2 135M",   hfRepoId: "HuggingFaceTB/SmolLM2-135M-Instruct", parametersBillion: 0.135, fp16SizeGb: 0.3, family: "SmolLM", description: "Smallest useful LLM" },
  "smollm2:360m":   { ollamaId: "smollm2:360m",   name: "SmolLM2 360M",   hfRepoId: "HuggingFaceTB/SmolLM2-360M-Instruct", parametersBillion: 0.36,  fp16SizeGb: 0.72, family: "SmolLM", description: "Tiny edge model" },
  "smollm2:1.7b":   { ollamaId: "smollm2:1.7b",   name: "SmolLM2 1.7B",   hfRepoId: "HuggingFaceTB/SmolLM2-1.7B-Instruct", parametersBillion: 1.7,   fp16SizeGb: 3.4, family: "SmolLM", description: "Largest SmolLM2" },
  "granite3:2b":    { ollamaId: "granite3:2b",    name: "Granite 3 2B",   hfRepoId: "ibm-granite/granite-3.0-2b-instruct", parametersBillion: 2,     fp16SizeGb: 4,   family: "Granite", description: "IBM enterprise model" },
  "granite3:8b":    { ollamaId: "granite3:8b",    name: "Granite 3 8B",   hfRepoId: "ibm-granite/granite-3.0-8b-instruct", parametersBillion: 8,     fp16SizeGb: 16,  family: "Granite", description: "Larger Granite" },
};

/**
 * Parse a parameter count from common tag conventions:
 *   "qwen3:4b"      -> 4
 *   "llama3.1:70b"  -> 70
 *   "tinyllama:1.1b"-> 1.1
 *   "smollm2:135m"  -> 0.135
 *   "phi3:mini"     -> null (no size tag)
 *
 * Ollama tags are remarkably consistent about using `:<number><b|m>`
 * suffixes for parameter counts. This covers ~95% of the models a user
 * will have installed.
 */
export function parseParameterCount(modelName: string): number | null {
  const tag = modelName.includes(":") ? modelName.split(":")[1] : modelName;
  // Match patterns like "4b", "1.5b", "70b", "135m", "8x7b" (MoE)
  const moeMatch = tag.match(/^(\d+)x(\d+(?:\.\d+)?)b\b/i);
  if (moeMatch) {
    // 8x7b ~= 46.7B total params (Mixtral convention)
    return parseInt(moeMatch[1], 10) * parseFloat(moeMatch[2]) * 0.84;
  }
  const bMatch = tag.match(/^(\d+(?:\.\d+)?)b\b/i);
  if (bMatch) return parseFloat(bMatch[1]);
  const mMatch = tag.match(/^(\d+(?:\.\d+)?)m\b/i);
  if (mMatch) return parseFloat(mMatch[1]) / 1000;
  return null;
}

/**
 * Build a synthetic model entry from an Ollama name with a size tag.
 * Used when the name isn't in the curated registry but we can still
 * infer enough from the tag to estimate sizes and recommend quants.
 */
function syntheticFromOllamaName(ollamaId: string): ResolvedModel | null {
  const params = parseParameterCount(ollamaId);
  if (!params) return null;

  const baseName = ollamaId.split(":")[0];
  // Best-effort family detection from name prefix. Include trailing digits
  // so "gemma4" -> "Gemma4", "llama3" -> "Llama3".
  const familyMatch = baseName.match(/^([a-z][a-z0-9]*)/i);
  const family = familyMatch
    ? familyMatch[1].charAt(0).toUpperCase() + familyMatch[1].slice(1).toLowerCase()
    : "Unknown";

  return {
    ollamaId,
    name: `${baseName} ${params}B`,
    // Without a real HF repo we can't do --from-source, but the local
    // path (re-quantizing the installed blob) still works perfectly.
    hfRepoId: "",
    parametersBillion: params,
    fp16SizeGb: Math.round(params * 2 * 10) / 10, // ~2 bytes/param at FP16
    family,
    description: "Auto-detected from tag",
    synthetic: true,
  };
}

export function resolveModel(input: string): ResolvedModel | null {
  // 1. Direct match in curated registry
  if (MODEL_MAP[input]) return MODEL_MAP[input];

  // 2. Common variations (lowercase, :latest suffix)
  const variations = [input, `${input}:latest`, input.toLowerCase()];
  for (const v of variations) {
    if (MODEL_MAP[v]) return MODEL_MAP[v];
  }

  // 3. Substring match on registry entries
  const lower = input.toLowerCase();
  const partial = Object.values(MODEL_MAP).find(
    (m) => m.ollamaId.toLowerCase() === lower || m.name.toLowerCase() === lower,
  );
  if (partial) return partial;

  // 4. HuggingFace repo path (contains /)
  if (input.includes("/")) {
    // Try to parse a size hint from the repo name (e.g. "Qwen/Qwen3-14B").
    // HF repo names typically embed the size with a dash ("Qwen3-14B"),
    // so look for a size token anywhere after a non-digit boundary.
    const repoName = input.split("/").pop() || "";
    let params: number | null = null;
    const moe = repoName.match(/(\d+)x(\d+(?:\.\d+)?)b\b/i);
    if (moe) {
      params = parseInt(moe[1], 10) * parseFloat(moe[2]) * 0.84;
    } else {
      const b = repoName.match(/(?:^|[^0-9])(\d+(?:\.\d+)?)b\b/i);
      if (b) params = parseFloat(b[1]);
      else {
        const m = repoName.match(/(?:^|[^0-9])(\d+(?:\.\d+)?)m\b/i);
        if (m) params = parseFloat(m[1]) / 1000;
      }
    }
    return {
      ollamaId: input.replace(/\//g, "-").toLowerCase(),
      name: input,
      hfRepoId: input,
      parametersBillion: params || 0,
      fp16SizeGb: params ? Math.round(params * 2 * 10) / 10 : 0,
      family: "Custom",
      description: "HuggingFace repository",
      synthetic: true,
    };
  }

  // 5. Synthetic from an Ollama-style tag with a size suffix
  //    Handles things like "gemma4:12b", "glm-4.7-flash:latest" (no size -> null),
  //    "nemotron-3-super:70b", etc. Without this, 86% of a typical
  //    Ollama library fails to resolve.
  const synthetic = syntheticFromOllamaName(input);
  if (synthetic) return synthetic;

  return null;
}

const BPW_MAP: Record<string, number> = {
  q8_0: 8.5,
  q6_k: 6.6,
  q5_k_m: 5.7,
  q4_k_m: 4.9,
  q4_0: 4.5,
  q3_k_m: 3.9,
  q2_k: 3.35,
};

export function recommendQuantType(
  parametersBillion: number,
  maxModelGb: number,
): { quantType: string; label: string; estimatedSizeGb: number } {
  const options = [
    { quantType: "q8_0", label: "Best Quality" },
    { quantType: "q5_k_m", label: "High Quality" },
    { quantType: "q4_k_m", label: "Recommended" },
    { quantType: "q3_k_m", label: "Smaller" },
    { quantType: "q2_k", label: "Smallest" },
  ];

  for (const opt of options) {
    const bpw = BPW_MAP[opt.quantType] || 4.9;
    const sizeGb = (parametersBillion * 1e9 * bpw) / 8 / 1e9 + 0.1;
    if (sizeGb <= maxModelGb) {
      return { ...opt, estimatedSizeGb: Math.round(sizeGb * 100) / 100 };
    }
  }

  const bpw = BPW_MAP["q2_k"];
  return {
    quantType: "q2_k",
    label: "Smallest (may not fit)",
    estimatedSizeGb: Math.round(((parametersBillion * 1e9 * bpw) / 8 / 1e9 + 0.1) * 100) / 100,
  };
}
