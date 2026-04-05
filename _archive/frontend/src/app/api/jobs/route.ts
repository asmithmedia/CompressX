import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitCompressionJob } from "@/lib/compression-api";

// POST /api/jobs - Create a new compression job
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sourceType, sourceModelId, sourceModelName, method, config } = body;

  if (!sourceModelId || !method) {
    return NextResponse.json(
      { error: "sourceModelId and method are required" },
      { status: 400 }
    );
  }

  // Create job in database
  const job = await prisma.job.create({
    data: {
      userId: session.user.id,
      sourceType: sourceType || "HUGGINGFACE",
      sourceModelId,
      sourceModelName: sourceModelName || sourceModelId,
      method,
      config: config || {},
      status: "PENDING",
    },
  });

  // Submit to compression API
  try {
    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/jobs/callback`;
    await submitCompressionJob({
      job_id: job.id,
      source_type: job.sourceType,
      source_model_id: job.sourceModelId,
      method: job.method,
      config: job.config as Record<string, unknown>,
      callback_url: callbackUrl,
    });
  } catch (error) {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "FAILED", error: "Failed to submit to compression service" },
    });
    return NextResponse.json(
      { error: "Failed to submit compression job" },
      { status: 500 }
    );
  }

  return NextResponse.json(job, { status: 201 });
}

// GET /api/jobs - List user's jobs
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await prisma.job.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(jobs);
}
