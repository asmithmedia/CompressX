/**
 * Maps Ollama model names to HuggingFace repo IDs for pulling unquantized weights.
 * Also includes metadata about model sizes for hardware recommendations.
 */

export interface OllamaModel {
  /** Ollama pull name, e.g. "qwen3:4b" */
  ollamaId: string;
  /** Display name */
  name: string;
  /** HuggingFace repo with original unquantized weights */
  hfRepoId: string;
  /** Parameter count in billions */
  parametersBillion: number;
  /** Approximate unquantized size in GB (FP16) */
  fp16SizeGb: number;
  /** Model family */
  family: string;
  /** Short description */
  description: string;
  /** Popular / featured */
  featured: boolean;
}

export const OLLAMA_MODELS: OllamaModel[] = [
  // Qwen 3
  {
    ollamaId: "qwen3:0.6b",
    name: "Qwen 3 0.6B",
    hfRepoId: "Qwen/Qwen3-0.6B",
    parametersBillion: 0.6,
    fp16SizeGb: 1.2,
    family: "Qwen",
    description: "Ultra-lightweight, great for edge devices",
    featured: false,
  },
  {
    ollamaId: "qwen3:1.7b",
    name: "Qwen 3 1.7B",
    hfRepoId: "Qwen/Qwen3-1.7B",
    parametersBillion: 1.7,
    fp16SizeGb: 3.4,
    family: "Qwen",
    description: "Compact model, good for basic tasks",
    featured: false,
  },
  {
    ollamaId: "qwen3:4b",
    name: "Qwen 3 4B",
    hfRepoId: "Qwen/Qwen3-4B",
    parametersBillion: 4,
    fp16SizeGb: 8,
    family: "Qwen",
    description: "Great balance of speed and capability",
    featured: true,
  },
  {
    ollamaId: "qwen3:8b",
    name: "Qwen 3 8B",
    hfRepoId: "Qwen/Qwen3-8B",
    parametersBillion: 8,
    fp16SizeGb: 16,
    family: "Qwen",
    description: "Strong general-purpose model",
    featured: true,
  },
  {
    ollamaId: "qwen3:14b",
    name: "Qwen 3 14B",
    hfRepoId: "Qwen/Qwen3-14B",
    parametersBillion: 14,
    fp16SizeGb: 28,
    family: "Qwen",
    description: "High-quality reasoning and coding",
    featured: false,
  },
  {
    ollamaId: "qwen3:32b",
    name: "Qwen 3 32B",
    hfRepoId: "Qwen/Qwen3-32B",
    parametersBillion: 32,
    fp16SizeGb: 64,
    family: "Qwen",
    description: "Near-frontier performance",
    featured: false,
  },

  // Gemma
  {
    ollamaId: "gemma3:1b",
    name: "Gemma 3 1B",
    hfRepoId: "google/gemma-3-1b-pt",
    parametersBillion: 1,
    fp16SizeGb: 2,
    family: "Gemma",
    description: "Google's ultra-light model",
    featured: false,
  },
  {
    ollamaId: "gemma3:4b",
    name: "Gemma 3 4B",
    hfRepoId: "google/gemma-3-4b-pt",
    parametersBillion: 4,
    fp16SizeGb: 8,
    family: "Gemma",
    description: "Google's efficient 4B model",
    featured: true,
  },
  {
    ollamaId: "gemma3:12b",
    name: "Gemma 3 12B",
    hfRepoId: "google/gemma-3-12b-pt",
    parametersBillion: 12,
    fp16SizeGb: 24,
    family: "Gemma",
    description: "Strong reasoning from Google",
    featured: false,
  },
  {
    ollamaId: "gemma3:27b",
    name: "Gemma 3 27B",
    hfRepoId: "google/gemma-3-27b-pt",
    parametersBillion: 27,
    fp16SizeGb: 54,
    family: "Gemma",
    description: "Google's largest open model",
    featured: false,
  },

  // Llama 3
  {
    ollamaId: "llama3.2:1b",
    name: "Llama 3.2 1B",
    hfRepoId: "meta-llama/Llama-3.2-1B",
    parametersBillion: 1,
    fp16SizeGb: 2.5,
    family: "Llama",
    description: "Meta's lightweight model for edge",
    featured: false,
  },
  {
    ollamaId: "llama3.2:3b",
    name: "Llama 3.2 3B",
    hfRepoId: "meta-llama/Llama-3.2-3B",
    parametersBillion: 3,
    fp16SizeGb: 6.4,
    family: "Llama",
    description: "Compact, versatile Llama model",
    featured: true,
  },
  {
    ollamaId: "llama3.1:8b",
    name: "Llama 3.1 8B",
    hfRepoId: "meta-llama/Llama-3.1-8B",
    parametersBillion: 8,
    fp16SizeGb: 16,
    family: "Llama",
    description: "Popular general-purpose model",
    featured: true,
  },
  {
    ollamaId: "llama3.1:70b",
    name: "Llama 3.1 70B",
    hfRepoId: "meta-llama/Llama-3.1-70B",
    parametersBillion: 70,
    fp16SizeGb: 140,
    family: "Llama",
    description: "Frontier-class open model",
    featured: false,
  },

  // Mistral
  {
    ollamaId: "mistral:7b",
    name: "Mistral 7B",
    hfRepoId: "mistralai/Mistral-7B-v0.3",
    parametersBillion: 7,
    fp16SizeGb: 14.5,
    family: "Mistral",
    description: "Fast, efficient European model",
    featured: true,
  },
  {
    ollamaId: "mixtral:8x7b",
    name: "Mixtral 8x7B",
    hfRepoId: "mistralai/Mixtral-8x7B-v0.1",
    parametersBillion: 46.7,
    fp16SizeGb: 93,
    family: "Mistral",
    description: "Mixture-of-experts, top performance",
    featured: false,
  },

  // Phi
  {
    ollamaId: "phi4:14b",
    name: "Phi-4 14B",
    hfRepoId: "microsoft/phi-4",
    parametersBillion: 14,
    fp16SizeGb: 28,
    family: "Phi",
    description: "Microsoft's reasoning-focused model",
    featured: true,
  },
  {
    ollamaId: "phi3:mini",
    name: "Phi-3 Mini 3.8B",
    hfRepoId: "microsoft/Phi-3-mini-4k-instruct",
    parametersBillion: 3.8,
    fp16SizeGb: 7.6,
    family: "Phi",
    description: "Small but surprisingly capable",
    featured: false,
  },

  // CodeGemma / DeepSeek
  {
    ollamaId: "deepseek-coder-v2:16b",
    name: "DeepSeek Coder V2 16B",
    hfRepoId: "deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct",
    parametersBillion: 16,
    fp16SizeGb: 32,
    family: "DeepSeek",
    description: "Strong code generation model",
    featured: false,
  },
  {
    ollamaId: "codegemma:7b",
    name: "CodeGemma 7B",
    hfRepoId: "google/codegemma-7b",
    parametersBillion: 7,
    fp16SizeGb: 14,
    family: "Gemma",
    description: "Code-specialized from Google",
    featured: false,
  },

  // TinyLlama (for testing)
  {
    ollamaId: "tinyllama:1.1b",
    name: "TinyLlama 1.1B",
    hfRepoId: "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    parametersBillion: 1.1,
    fp16SizeGb: 2.2,
    family: "Llama",
    description: "Perfect for testing compression pipelines",
    featured: false,
  },
];

/** Group models by family for the picker UI */
export function getModelFamilies(): string[] {
  const families = new Set(OLLAMA_MODELS.map((m) => m.family));
  return Array.from(families).sort();
}

/** Get featured models for quick-start */
export function getFeaturedModels(): OllamaModel[] {
  return OLLAMA_MODELS.filter((m) => m.featured);
}

/** Search models by name, family, or Ollama ID */
export function searchOllamaModels(query: string): OllamaModel[] {
  const q = query.toLowerCase();
  return OLLAMA_MODELS.filter(
    (m) =>
      m.ollamaId.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.family.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q)
  );
}

/** Lookup by Ollama ID */
export function getModelByOllamaId(ollamaId: string): OllamaModel | undefined {
  return OLLAMA_MODELS.find((m) => m.ollamaId === ollamaId);
}

/**
 * Estimate the GGUF file size for a given model and quantization type.
 * Based on bits-per-weight * parameter count.
 */
export function estimateCompressedSize(
  parametersBillion: number,
  quantType: string
): { sizeGb: number; bitsPerWeight: number } {
  const bitsMap: Record<string, number> = {
    f16: 16,
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

  const bitsPerWeight = bitsMap[quantType] || 4.9;
  // Formula: (params * bits) / 8 bytes, plus ~0.5 GB overhead for metadata/KV cache structure
  const sizeGb = (parametersBillion * 1e9 * bitsPerWeight) / 8 / 1e9 + 0.1;

  return { sizeGb: Math.round(sizeGb * 100) / 100, bitsPerWeight };
}
