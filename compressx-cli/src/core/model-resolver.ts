interface ResolvedModel {
  ollamaId: string;
  name: string;
  hfRepoId: string;
  parametersBillion: number;
  fp16SizeGb: number;
  family: string;
  description: string;
}

// Inline registry to avoid cross-package issues with npx
const MODEL_MAP: Record<string, ResolvedModel> = {
  "qwen3:0.6b": { ollamaId: "qwen3:0.6b", name: "Qwen 3 0.6B", hfRepoId: "Qwen/Qwen3-0.6B", parametersBillion: 0.6, fp16SizeGb: 1.2, family: "Qwen", description: "Ultra-lightweight" },
  "qwen3:1.7b": { ollamaId: "qwen3:1.7b", name: "Qwen 3 1.7B", hfRepoId: "Qwen/Qwen3-1.7B", parametersBillion: 1.7, fp16SizeGb: 3.4, family: "Qwen", description: "Compact" },
  "qwen3:4b": { ollamaId: "qwen3:4b", name: "Qwen 3 4B", hfRepoId: "Qwen/Qwen3-4B", parametersBillion: 4, fp16SizeGb: 8, family: "Qwen", description: "Balanced" },
  "qwen3:8b": { ollamaId: "qwen3:8b", name: "Qwen 3 8B", hfRepoId: "Qwen/Qwen3-8B", parametersBillion: 8, fp16SizeGb: 16, family: "Qwen", description: "General-purpose" },
  "qwen3:14b": { ollamaId: "qwen3:14b", name: "Qwen 3 14B", hfRepoId: "Qwen/Qwen3-14B", parametersBillion: 14, fp16SizeGb: 28, family: "Qwen", description: "High-quality" },
  "qwen3:32b": { ollamaId: "qwen3:32b", name: "Qwen 3 32B", hfRepoId: "Qwen/Qwen3-32B", parametersBillion: 32, fp16SizeGb: 64, family: "Qwen", description: "Near-frontier" },
  "gemma3:4b": { ollamaId: "gemma3:4b", name: "Gemma 3 4B", hfRepoId: "google/gemma-3-4b-pt", parametersBillion: 4, fp16SizeGb: 8, family: "Gemma", description: "Efficient" },
  "gemma3:12b": { ollamaId: "gemma3:12b", name: "Gemma 3 12B", hfRepoId: "google/gemma-3-12b-pt", parametersBillion: 12, fp16SizeGb: 24, family: "Gemma", description: "Strong reasoning" },
  "gemma3:27b": { ollamaId: "gemma3:27b", name: "Gemma 3 27B", hfRepoId: "google/gemma-3-27b-pt", parametersBillion: 27, fp16SizeGb: 54, family: "Gemma", description: "Largest Gemma" },
  "llama3.2:1b": { ollamaId: "llama3.2:1b", name: "Llama 3.2 1B", hfRepoId: "meta-llama/Llama-3.2-1B", parametersBillion: 1, fp16SizeGb: 2.5, family: "Llama", description: "Edge" },
  "llama3.2:3b": { ollamaId: "llama3.2:3b", name: "Llama 3.2 3B", hfRepoId: "meta-llama/Llama-3.2-3B", parametersBillion: 3, fp16SizeGb: 6.4, family: "Llama", description: "Compact" },
  "llama3.1:8b": { ollamaId: "llama3.1:8b", name: "Llama 3.1 8B", hfRepoId: "meta-llama/Llama-3.1-8B", parametersBillion: 8, fp16SizeGb: 16, family: "Llama", description: "Popular" },
  "llama3.1:70b": { ollamaId: "llama3.1:70b", name: "Llama 3.1 70B", hfRepoId: "meta-llama/Llama-3.1-70B", parametersBillion: 70, fp16SizeGb: 140, family: "Llama", description: "Frontier" },
  "mistral:7b": { ollamaId: "mistral:7b", name: "Mistral 7B", hfRepoId: "mistralai/Mistral-7B-v0.3", parametersBillion: 7, fp16SizeGb: 14.5, family: "Mistral", description: "Efficient" },
  "phi4:14b": { ollamaId: "phi4:14b", name: "Phi-4 14B", hfRepoId: "microsoft/phi-4", parametersBillion: 14, fp16SizeGb: 28, family: "Phi", description: "Reasoning-focused" },
  "phi3:mini": { ollamaId: "phi3:mini", name: "Phi-3 Mini", hfRepoId: "microsoft/Phi-3-mini-4k-instruct", parametersBillion: 3.8, fp16SizeGb: 7.6, family: "Phi", description: "Capable" },
  "tinyllama:1.1b": { ollamaId: "tinyllama:1.1b", name: "TinyLlama 1.1B", hfRepoId: "TinyLlama/TinyLlama-1.1B-Chat-v1.0", parametersBillion: 1.1, fp16SizeGb: 2.2, family: "Llama", description: "Testing" },
};

export function resolveModel(input: string): ResolvedModel | null {
  // Direct Ollama ID match
  if (MODEL_MAP[input]) return MODEL_MAP[input];

  // Try with default variant
  const variations = [input, `${input}:latest`, input.toLowerCase()];
  for (const v of variations) {
    if (MODEL_MAP[v]) return MODEL_MAP[v];
  }

  // Partial match
  const lower = input.toLowerCase();
  const match = Object.values(MODEL_MAP).find(
    (m) => m.ollamaId.includes(lower) || m.name.toLowerCase().includes(lower)
  );
  if (match) return match;

  // If it looks like a HuggingFace repo (contains /), create a synthetic entry
  if (input.includes("/")) {
    return {
      ollamaId: input.replace("/", "-").toLowerCase(),
      name: input,
      hfRepoId: input,
      parametersBillion: 0,
      fp16SizeGb: 0,
      family: "Custom",
      description: "Custom HuggingFace model",
    };
  }

  return null;
}

const BPW_MAP: Record<string, number> = {
  q8_0: 8.5, q6_k: 6.6, q5_k_m: 5.7, q4_k_m: 4.9, q4_0: 4.5, q3_k_m: 3.9, q2_k: 3.35,
};

export function recommendQuantType(
  parametersBillion: number,
  maxModelGb: number
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

  // Fallback to most aggressive
  const bpw = BPW_MAP["q2_k"];
  return {
    quantType: "q2_k",
    label: "Smallest (may not fit)",
    estimatedSizeGb: Math.round(((parametersBillion * 1e9 * bpw) / 8 / 1e9 + 0.1) * 100) / 100,
  };
}
