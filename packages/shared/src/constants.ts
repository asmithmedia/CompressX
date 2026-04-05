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

export const COMPRESSX_API_URL = "https://compressx.asmith.media/api/v1";
export const COMPRESSX_CONFIG_DIR = ".compressx";
