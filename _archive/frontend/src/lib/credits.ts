import { prisma } from "@/lib/prisma";

/**
 * Get the current credit balance for a user.
 */
export async function getCreditBalance(userId: string): Promise<number> {
  const latest = await prisma.creditLedger.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return latest?.balance ?? 0;
}

/**
 * Deduct credits for a compression job. Returns the new balance.
 * Throws if insufficient credits and overage not allowed.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  jobId: string
): Promise<number> {
  const balance = await getCreditBalance(userId);
  const newBalance = balance - amount;

  await prisma.creditLedger.create({
    data: {
      userId,
      amount: -amount,
      balance: newBalance,
      reason: "compression_job",
      jobId,
    },
  });

  return newBalance;
}

/**
 * Refund credits for a failed job.
 */
export async function refundCredits(
  userId: string,
  amount: number,
  jobId: string
): Promise<number> {
  const balance = await getCreditBalance(userId);
  const newBalance = balance + amount;

  await prisma.creditLedger.create({
    data: {
      userId,
      amount,
      balance: newBalance,
      reason: "refund_failed_job",
      jobId,
    },
  });

  return newBalance;
}

/**
 * Allocate monthly credits for a user.
 */
export async function allocateMonthlyCredits(
  userId: string,
  amount: number
): Promise<number> {
  const balance = await getCreditBalance(userId);
  const newBalance = balance + amount;

  await prisma.creditLedger.create({
    data: {
      userId,
      amount,
      balance: newBalance,
      reason: "monthly_allocation",
    },
  });

  return newBalance;
}
