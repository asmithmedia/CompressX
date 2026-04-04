import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getCreditBalance, deductCredits } from "@/lib/credits";
import { submitCompressionJob } from "@/lib/compression-api";

export async function POST(request: NextRequest) {
  const user = await authenticateApiKey(request);
  if (!user) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const body = await request.json();
  const { sourceModelId, sourceModelName, method, config } = body;

  if (!sourceModelId || !method) {
    return NextResponse.json(
      { error: "sourceModelId and method are required" },
      { status: 400 }
    );
  }

  // Check credits
  const balance = await getCreditBalance(user.id);
  const cost = Math.ceil(parseFloat(body.fp16SizeGb || "1")); // default 1 credit

  if (balance < cost && user.tier === "FREE") {
    return NextResponse.json(
      { error: "Insufficient credits", balance, cost },
      { status: 402 }
    );
  }

  // Create job
  const job = await prisma.job.create({
    data: {
      userId: user.id,
      sourceType: "HUGGINGFACE",
      sourceModelId,
      sourceModelName: sourceModelName || sourceModelId,
      method: method || "GGUF",
      config: config || {},
      status: "PENDING",
      creditsCost: cost,
    },
  });

  // Deduct credits
  await deductCredits(user.id, cost, job.id);

  // Submit to backend
  try {
    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/jobs/callback`;
    await submitCompressionJob({
      job_id: job.id,
      source_type: "HUGGINGFACE",
      source_model_id: sourceModelId,
      method: method || "GGUF",
      config: config || {},
      callback_url: callbackUrl,
    });
  } catch {
    // Refund on failure
    const { refundCredits } = await import("@/lib/credits");
    await refundCredits(user.id, cost, job.id);
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "FAILED", error: "Failed to submit to compression service" },
    });
    return NextResponse.json({ error: "Compression service unavailable" }, { status: 503 });
  }

  return NextResponse.json({
    id: job.id,
    status: "PENDING",
    creditsCost: cost,
    creditsRemaining: balance - cost,
  }, { status: 201 });
}
