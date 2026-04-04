import type { UserTier } from "./types.js";

export interface TierLimits {
  monthlyCredits: number;
  webCompressions: number;
  cloudCompressions: number;
  maxModelSizeB: number;
  concurrentJobs: number;
  retentionHours: number;
  mcpWriteAccess: boolean;
  overageAllowed: boolean;
  overageRatePerCredit: number;
  price: number;
}

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  FREE: {
    monthlyCredits: 100,
    webCompressions: 3,
    cloudCompressions: 3,
    maxModelSizeB: 3,
    concurrentJobs: 1,
    retentionHours: 24,
    mcpWriteAccess: false,
    overageAllowed: false,
    overageRatePerCredit: 0,
    price: 0,
  },
  DEVELOPER: {
    monthlyCredits: 2000,
    webCompressions: 25,
    cloudCompressions: 25,
    maxModelSizeB: 70,
    concurrentJobs: 3,
    retentionHours: 168, // 7 days
    mcpWriteAccess: true,
    overageAllowed: true,
    overageRatePerCredit: 0.01,
    price: 19,
  },
  TEAM: {
    monthlyCredits: 10000,
    webCompressions: 100,
    cloudCompressions: 100,
    maxModelSizeB: Infinity,
    concurrentJobs: 10,
    retentionHours: 720, // 30 days
    mcpWriteAccess: true,
    overageAllowed: true,
    overageRatePerCredit: 0.01,
    price: 49,
  },
  ENTERPRISE: {
    monthlyCredits: Infinity,
    webCompressions: Infinity,
    cloudCompressions: Infinity,
    maxModelSizeB: Infinity,
    concurrentJobs: Infinity,
    retentionHours: 2160, // 90 days
    mcpWriteAccess: true,
    overageAllowed: true,
    overageRatePerCredit: 0,
    price: 0, // custom
  },
};

/**
 * Calculate credit cost for a compression job.
 * 1 credit = 1 GB of source model (FP16 size).
 */
export function calculateCreditCost(fp16SizeGb: number): number {
  return Math.ceil(fp16SizeGb);
}

/**
 * Check if a user can afford a compression job.
 */
export function canAffordJob(
  currentBalance: number,
  fp16SizeGb: number,
  tier: UserTier
): { canAfford: boolean; cost: number; remainingAfter: number; overageAmount: number } {
  const cost = calculateCreditCost(fp16SizeGb);
  const limits = TIER_LIMITS[tier];

  if (currentBalance >= cost) {
    return {
      canAfford: true,
      cost,
      remainingAfter: currentBalance - cost,
      overageAmount: 0,
    };
  }

  if (limits.overageAllowed) {
    return {
      canAfford: true,
      cost,
      remainingAfter: currentBalance - cost, // will be negative
      overageAmount: cost - currentBalance,
    };
  }

  return {
    canAfford: false,
    cost,
    remainingAfter: currentBalance,
    overageAmount: 0,
  };
}
