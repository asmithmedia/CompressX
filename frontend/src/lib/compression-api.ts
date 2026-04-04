const COMPRESSION_API_URL = process.env.COMPRESSION_API_URL || "http://localhost:8000";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";

interface CompressJobRequest {
  job_id: string;
  source_type: string;
  source_model_id: string;
  method: string;
  config: Record<string, unknown>;
  callback_url?: string;
}

export async function submitCompressionJob(request: CompressJobRequest) {
  const res = await fetch(`${COMPRESSION_API_URL}/api/jobs/compress`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": INTERNAL_API_KEY,
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Compression API error: ${res.status} ${error}`);
  }

  return res.json();
}

export async function checkApiHealth() {
  const res = await fetch(`${COMPRESSION_API_URL}/health`);
  return res.json();
}
