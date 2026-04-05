import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { getCreditBalance } from "@/lib/credits";

export async function GET(request: NextRequest) {
  const user = await authenticateApiKey(request);
  if (!user) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const balance = await getCreditBalance(user.id);

  // Tier limits
  const tierLimits: Record<string, number> = {
    FREE: 100,
    DEVELOPER: 2000,
    TEAM: 10000,
    ENTERPRISE: Infinity,
  };

  return NextResponse.json({
    tier: user.tier,
    balance,
    monthlyAllocation: tierLimits[user.tier] || 100,
    email: user.email,
  });
}
