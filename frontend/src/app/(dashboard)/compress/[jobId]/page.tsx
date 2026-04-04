"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useJobProgress } from "@/hooks/useJobProgress";
import { JOB_STATUS_LABELS } from "@/lib/constants";
import type { Job, CompressionMetrics } from "@/types/job";

const STEPS = [
  { status: "PENDING", label: "Queued" },
  { status: "DOWNLOADING", label: "Downloading" },
  { status: "COMPRESSING", label: "Compressing" },
  { status: "EVALUATING", label: "Evaluating" },
  { status: "UPLOADING", label: "Uploading" },
  { status: "COMPLETED", label: "Complete" },
];

const STEP_ORDER = STEPS.map((s) => s.status);

export default function JobProgressPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [job, setJob] = useState<Job | null>(null);

  const { progress, status, message, metrics, downloadUrl, error } =
    useJobProgress(jobId);

  useEffect(() => {
    fetch(`/api/jobs/${jobId}`)
      .then((r) => r.json())
      .then(setJob)
      .catch(() => {});
  }, [jobId]);

  const currentStepIndex = STEP_ORDER.indexOf(status);
  const isFailed = status === "FAILED";
  const isComplete = status === "COMPLETED";
  const finalMetrics = metrics || (job?.metrics as CompressionMetrics | null);
  const finalDownloadUrl = downloadUrl || job?.downloadUrl;

  function formatBytes(bytes: number) {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/history"
          className="text-gray-400 hover:text-white transition"
        >
          Jobs
        </Link>
        <span className="text-gray-600">/</span>
        <span className="text-white">
          {job?.sourceModelName || job?.sourceModelId || jobId}
        </span>
      </div>

      {/* Progress bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">
            {isComplete
              ? "Compression Complete!"
              : isFailed
                ? "Compression Failed"
                : JOB_STATUS_LABELS[status] || "Processing..."}
          </h2>
          {!isComplete && !isFailed && (
            <span className="text-blue-400 font-mono">{progress}%</span>
          )}
        </div>

        {/* Progress bar */}
        {!isComplete && !isFailed && (
          <div className="w-full h-2 bg-gray-800 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {message && !isComplete && !isFailed && (
          <p className="text-gray-400 text-sm">{message}</p>
        )}

        {isFailed && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400">{error || job?.error || "An error occurred"}</p>
          </div>
        )}

        {/* Step timeline */}
        <div className="mt-6 flex items-center gap-2">
          {STEPS.map((step, i) => {
            const isActive = step.status === status;
            const isPast = currentStepIndex > i;
            const isCurrent = isActive && !isComplete;

            return (
              <div key={step.status} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition ${
                      isComplete && i <= 5
                        ? "bg-green-600 border-green-500 text-white"
                        : isPast
                          ? "bg-blue-600 border-blue-500 text-white"
                          : isCurrent
                            ? "bg-blue-600/20 border-blue-500 text-blue-400 animate-pulse"
                            : "bg-gray-800 border-gray-700 text-gray-500"
                    }`}
                  >
                    {isComplete && i <= 5 ? "\u2713" : isPast ? "\u2713" : i + 1}
                  </div>
                  <span
                    className={`text-xs mt-1 ${
                      isActive || isPast || isComplete
                        ? "text-gray-300"
                        : "text-gray-600"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 ${
                      isPast || (isComplete && i < 5)
                        ? "bg-blue-600"
                        : "bg-gray-800"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Metrics */}
      {finalMetrics && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Compression Results
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400">Original Size</div>
              <div className="text-xl font-bold text-white mt-1">
                {formatBytes(finalMetrics.original_size_bytes)}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400">Compressed Size</div>
              <div className="text-xl font-bold text-green-400 mt-1">
                {formatBytes(finalMetrics.compressed_size_bytes)}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400">Compression Ratio</div>
              <div className="text-xl font-bold text-blue-400 mt-1">
                {finalMetrics.compression_ratio}x
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400">Size Reduction</div>
              <div className="text-xl font-bold text-purple-400 mt-1">
                {finalMetrics.size_reduction_pct}%
              </div>
            </div>
          </div>

          {finalMetrics.quant_type && (
            <div className="mt-4 flex gap-4 text-sm text-gray-400">
              <span>
                Format: <span className="text-white">{finalMetrics.format}</span>
              </span>
              <span>
                Quantization:{" "}
                <span className="text-white font-mono">
                  {finalMetrics.quant_type}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Download */}
      {isComplete && finalDownloadUrl && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Download Your Model
          </h2>
          <div className="flex items-center gap-4">
            <a
              href={finalDownloadUrl}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition inline-flex items-center gap-2"
            >
              Download GGUF File
            </a>
            <span className="text-gray-400 text-sm">
              {job?.outputFilename}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-3">
            This download link expires in 24 hours. Load this file in Ollama,
            llama.cpp, or LM Studio.
          </p>
        </div>
      )}
    </div>
  );
}
