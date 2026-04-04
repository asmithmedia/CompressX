import { auth } from "@/lib/auth";
import { getCreditBalance } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

const TIERS = [
  {
    name: "Free",
    tier: "FREE",
    price: "$0",
    credits: "100",
    features: ["3 cloud compressions/month", "Up to 3B models", "24h download links", "Unlimited local CLI"],
    current: false,
  },
  {
    name: "Developer",
    tier: "DEVELOPER",
    price: "$19/mo",
    credits: "2,000",
    features: ["25 cloud compressions/month", "Up to 70B models", "7-day download links", "MCP Server access", "API access", "Priority queue"],
    current: false,
    highlighted: true,
  },
  {
    name: "Team",
    tier: "TEAM",
    price: "$49/seat/mo",
    credits: "10,000",
    features: ["100 cloud compressions/month", "Unlimited model size", "30-day download links", "10 concurrent jobs", "Overage at $0.01/credit"],
    current: false,
  },
];

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const balance = await getCreditBalance(session.user.id);
  const jobCount = await prisma.job.count({ where: { userId: session.user.id } });

  const currentTier = user?.tier || "FREE";

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Billing & Credits</h1>
      <p className="text-gray-400 mb-8">
        Manage your subscription and track credit usage.
      </p>

      {/* Current usage */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="text-sm text-gray-400">Current Plan</div>
          <div className="text-2xl font-bold text-white mt-1 capitalize">
            {currentTier.toLowerCase()}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="text-sm text-gray-400">Credit Balance</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">{balance}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="text-sm text-gray-400">Total Jobs</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{jobCount}</div>
        </div>
      </div>

      {/* Pricing tiers */}
      <h2 className="text-lg font-semibold text-white mb-4">Plans</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {TIERS.map((tier) => {
          const isCurrent = tier.tier === currentTier;
          return (
            <div
              key={tier.tier}
              className={`rounded-xl p-6 border ${
                tier.highlighted
                  ? "bg-blue-600/10 border-blue-500/30"
                  : "bg-gray-900 border-gray-800"
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {tier.name}
                  </h3>
                  <div className="text-2xl font-bold text-white mt-1">
                    {tier.price}
                  </div>
                </div>
                {isCurrent && (
                  <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs font-medium">
                    Current
                  </span>
                )}
              </div>

              <div className="text-sm text-gray-400 mb-4">
                {tier.credits} credits/month
              </div>

              <ul className="space-y-2 mb-6">
                {tier.features.map((f) => (
                  <li key={f} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">+</span>
                    {f}
                  </li>
                ))}
              </ul>

              {!isCurrent && tier.tier !== "FREE" && (
                <button className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition text-sm">
                  Upgrade
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
