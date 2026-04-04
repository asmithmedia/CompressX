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

export type UserTier = "FREE" | "DEVELOPER" | "TEAM" | "ENTERPRISE";
