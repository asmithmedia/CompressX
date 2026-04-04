import Link from "next/link";

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      <div className="space-y-4">
        <Link
          href="/settings/api-keys"
          className="block bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition"
        >
          <h2 className="text-lg font-semibold text-white">API Keys</h2>
          <p className="text-gray-400 text-sm mt-1">
            Manage API keys for CLI, MCP Server, and programmatic access.
          </p>
        </Link>

        <Link
          href="/settings/billing"
          className="block bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition"
        >
          <h2 className="text-lg font-semibold text-white">Billing & Credits</h2>
          <p className="text-gray-400 text-sm mt-1">
            View your credit balance, usage, and manage your subscription.
          </p>
        </Link>
      </div>
    </div>
  );
}
