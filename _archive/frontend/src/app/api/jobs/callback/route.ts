import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/jobs/callback - Called by the Python backend when a job completes/fails
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { job_id, status, metrics, output_key, download_url, error } = body;

  if (!job_id || !status) {
    return NextResponse.json({ error: "job_id and status required" }, { status: 400 });
  }

  await prisma.job.update({
    where: { id: job_id },
    data: {
      status,
      progress: status === "COMPLETED" ? 100 : 0,
      metrics: metrics || undefined,
      outputKey: output_key || undefined,
      downloadUrl: download_url || undefined,
      error: error || undefined,
      completedAt: status === "COMPLETED" ? new Date() : undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
