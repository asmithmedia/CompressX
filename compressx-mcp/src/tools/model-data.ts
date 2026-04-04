// Inline model data for the MCP server (avoid cross-package deps)

interface ModelInfo {
  ollamaId: string;
  name: string;
  hfRepoId: string;
  parametersBillion: number;
  fp16SizeGb: number;
  family: string;
  description: string;
}

export const OLLAMA_MODELS: ModelInfo[] = [
  { ollamaId: "qwen3:0.6b", name: "Qwen 3 0.6B", hfRepoId: "Qwen/Qwen3-0.6B", parametersBillion: 0.6, fp16SizeGb: 1.2, family: "Qwen", description: "Ultra-lightweight, edge devices" },
  { ollamaId: "qwen3:4b", name: "Qwen 3 4B", hfRepoId: "Qwen/Qwen3-4B", parametersBillion: 4, fp16SizeGb: 8, family: "Qwen", description: "Great balance of speed and capability" },
  { ollamaId: "qwen3:8b", name: "Qwen 3 8B", hfRepoId: "Qwen/Qwen3-8B", parametersBillion: 8, fp16SizeGb: 16, family: "Qwen", description: "Strong general-purpose" },
  { ollamaId: "qwen3:14b", name: "Qwen 3 14B", hfRepoId: "Qwen/Qwen3-14B", parametersBillion: 14, fp16SizeGb: 28, family: "Qwen", description: "High-quality reasoning" },
  { ollamaId: "qwen3:32b", name: "Qwen 3 32B", hfRepoId: "Qwen/Qwen3-32B", parametersBillion: 32, fp16SizeGb: 64, family: "Qwen", description: "Near-frontier" },
  { ollamaId: "gemma3:4b", name: "Gemma 3 4B", hfRepoId: "google/gemma-3-4b-pt", parametersBillion: 4, fp16SizeGb: 8, family: "Gemma", description: "Google's efficient model" },
  { ollamaId: "gemma3:12b", name: "Gemma 3 12B", hfRepoId: "google/gemma-3-12b-pt", parametersBillion: 12, fp16SizeGb: 24, family: "Gemma", description: "Strong reasoning" },
  { ollamaId: "gemma3:27b", name: "Gemma 3 27B", hfRepoId: "google/gemma-3-27b-pt", parametersBillion: 27, fp16SizeGb: 54, family: "Gemma", description: "Largest Gemma" },
  { ollamaId: "llama3.2:3b", name: "Llama 3.2 3B", hfRepoId: "meta-llama/Llama-3.2-3B", parametersBillion: 3, fp16SizeGb: 6.4, family: "Llama", description: "Compact" },
  { ollamaId: "llama3.1:8b", name: "Llama 3.1 8B", hfRepoId: "meta-llama/Llama-3.1-8B", parametersBillion: 8, fp16SizeGb: 16, family: "Llama", description: "Popular" },
  { ollamaId: "llama3.1:70b", name: "Llama 3.1 70B", hfRepoId: "meta-llama/Llama-3.1-70B", parametersBillion: 70, fp16SizeGb: 140, family: "Llama", description: "Frontier" },
  { ollamaId: "mistral:7b", name: "Mistral 7B", hfRepoId: "mistralai/Mistral-7B-v0.3", parametersBillion: 7, fp16SizeGb: 14.5, family: "Mistral", description: "Fast, efficient" },
  { ollamaId: "phi4:14b", name: "Phi-4 14B", hfRepoId: "microsoft/phi-4", parametersBillion: 14, fp16SizeGb: 28, family: "Phi", description: "Reasoning-focused" },
  { ollamaId: "tinyllama:1.1b", name: "TinyLlama 1.1B", hfRepoId: "TinyLlama/TinyLlama-1.1B-Chat-v1.0", parametersBillion: 1.1, fp16SizeGb: 2.2, family: "Llama", description: "Testing" },
];

export function searchModels(query: string): ModelInfo[] {
  const q = query.toLowerCase();
  return OLLAMA_MODELS.filter(
    (m) => m.ollamaId.includes(q) || m.name.toLowerCase().includes(q) || m.family.toLowerCase().includes(q)
  );
}

const BPW: Record<string, number> = {
  f16: 16, q8_0: 8.5, q6_k: 6.6, q5_k_m: 5.7, q4_k_m: 4.9, q4_0: 4.5, q3_k_m: 3.9, q2_k: 3.35,
};

export function estimateCompressedSize(paramsBillion: number, quantType: string): number {
  const bpw = BPW[quantType] || 4.9;
  return Math.round(((paramsBillion * 1e9 * bpw) / 8 / 1e9 + 0.1) * 100) / 100;
}

export function recommendQuantForHardware(
  paramsBillion: number,
  ramGb: number | null,
  vramGb: number | null,
  prioritize: "quality" | "size" | "speed"
) {
  let maxGb: number;
  if (vramGb && vramGb >= 4) {
    maxGb = Math.floor(vramGb * 0.85);
  } else if (ramGb) {
    maxGb = Math.floor(ramGb * 0.6);
  } else {
    maxGb = 8;
  }

  const options = [
    { quantType: "q8_0", label: "Best Quality", bpw: 8.5 },
    { quantType: "q6_k", label: "Very High Quality", bpw: 6.6 },
    { quantType: "q5_k_m", label: "High Quality", bpw: 5.7 },
    { quantType: "q4_k_m", label: "Recommended Balance", bpw: 4.9 },
    { quantType: "q4_0", label: "Good, Fast Inference", bpw: 4.5 },
    { quantType: "q3_k_m", label: "Smaller, Lower Quality", bpw: 3.9 },
    { quantType: "q2_k", label: "Smallest, Noticeable Loss", bpw: 3.35 },
  ];

  // If prioritizing size, reverse the preference
  const sorted = prioritize === "size" ? [...options].reverse() : options;

  return sorted.map((opt) => {
    const sizeGb = estimateCompressedSize(paramsBillion, opt.quantType);
    return {
      quantType: opt.quantType,
      label: opt.label,
      estimatedSizeGb: sizeGb,
      fitsInMemory: sizeGb <= maxGb,
      recommended: sizeGb <= maxGb,
    };
  });
}
