export const QUANT_TYPES = [
  { value: "f16", label: "FP16", description: "Minimal loss, ~50% size reduction", quality: 5 },
  { value: "q8_0", label: "Q8_0", description: "Very low loss, ~4x compression", quality: 5 },
  { value: "q6_k", label: "Q6_K", description: "Low loss, ~5x compression", quality: 4 },
  { value: "q5_k_m", label: "Q5_K_M", description: "Good balance of quality and size", quality: 4 },
  { value: "q4_k_m", label: "Q4_K_M", description: "Most popular. Great quality, ~6x compression", quality: 4 },
  { value: "q4_0", label: "Q4_0", description: "Fast inference, slightly lower quality", quality: 3 },
  { value: "q3_k_m", label: "Q3_K_M", description: "Aggressive compression, noticeable impact", quality: 2 },
  { value: "q2_k", label: "Q2_K", description: "Maximum compression, significant quality loss", quality: 1 },
] as const;

export const JOB_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  DOWNLOADING: "Downloading Model",
  COMPRESSING: "Compressing",
  EVALUATING: "Evaluating Quality",
  UPLOADING: "Uploading Result",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export const JOB_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  DOWNLOADING: "bg-blue-100 text-blue-700",
  COMPRESSING: "bg-yellow-100 text-yellow-700",
  EVALUATING: "bg-purple-100 text-purple-700",
  UPLOADING: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export const COMPRESSION_METHODS = [
  {
    value: "GGUF",
    label: "GGUF Quantization",
    description: "Convert to GGUF format for llama.cpp, Ollama, and other local inference engines",
    icon: "archive",
    available: true,
  },
  {
    value: "GPTQ",
    label: "GPTQ Quantization",
    description: "GPU-optimized quantization for vLLM and TGI inference servers",
    icon: "cpu",
    available: false,
  },
  {
    value: "AWQ",
    label: "AWQ Quantization",
    description: "Activation-aware quantization for fast GPU inference",
    icon: "zap",
    available: false,
  },
] as const;
