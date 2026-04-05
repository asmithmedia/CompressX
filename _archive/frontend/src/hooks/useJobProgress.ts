"use client";

import { useState, useEffect, useCallback } from "react";
import type { JobProgressEvent, JobStatus } from "@/types/job";

export function useJobProgress(jobId: string | null) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<JobStatus>("PENDING");
  const [message, setMessage] = useState("");
  const [metrics, setMetrics] = useState<JobProgressEvent["metrics"]>(undefined);
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!jobId) return;

    const eventSource = new EventSource(`/api/jobs/${jobId}/progress`);

    eventSource.onmessage = (event) => {
      const data: JobProgressEvent = JSON.parse(event.data);
      setProgress(data.progress);
      setStatus(data.status);
      setMessage(data.message);

      if (data.metrics) setMetrics(data.metrics);
      if (data.download_url) setDownloadUrl(data.download_url);
      if (data.error) setError(data.error);

      if (data.status === "COMPLETED" || data.status === "FAILED") {
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [jobId]);

  return { progress, status, message, metrics, downloadUrl, error };
}
