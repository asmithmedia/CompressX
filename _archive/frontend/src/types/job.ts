export interface Job {
  id: string;
  userId: string;
  sourceType: "HUGGINGFACE" | "UPLOAD";
  sourceModelId: string;
  sourceModelName: string | null;
  method: "GGUF" | "GPTQ" | "AWQ" | "BITSANDBYTES" | "SPARSEGPT" | "WANDA";
  config: Record<string, unknown>;
  status: JobStatus;
  progress: number;
  progressMessage: string | null;
  metrics: CompressionMetrics | null;
  outputKey: string | null;
  outputFilename: string | null;
  downloadUrl: string | null;
  error: string | null;
  creditsCost: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type JobStatus =
  | "PENDING"
  | "DOWNLOADING"
  | "COMPRESSING"
  | "EVALUATING"
  | "UPLOADING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface CompressionMetrics {
  original_size_bytes: number;
  compressed_size_bytes: number;
  original_size_gb: number;
  compressed_size_gb: number;
  compression_ratio: number;
  size_reduction_pct: number;
  method: string;
  quant_type: string;
  format: string;
}

export interface JobProgressEvent {
  job_id: string;
  status: JobStatus;
  progress: number;
  message: string;
  metrics?: CompressionMetrics;
  output_key?: string;
  download_url?: string;
  output_filename?: string;
  error?: string;
}
