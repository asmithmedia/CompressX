"use client";

import { useState, useEffect } from "react";

interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    const res = await fetch("/api/v1/auth/keys");
    if (res.ok) setKeys(await res.json());
  }

  async function createKey() {
    if (!newKeyName.trim()) return;
    setLoading(true);
    const res = await fetch("/api/v1/auth/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    });
    if (res.ok) {
      const data = await res.json();
      setCreatedKey(data.key);
      setNewKeyName("");
      fetchKeys();
    }
    setLoading(false);
  }

  async function revokeKey(keyId: string) {
    await fetch(`/api/v1/auth/keys/${keyId}`, { method: "DELETE" });
    fetchKeys();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">API Keys</h1>
      <p className="text-gray-400 mb-8">
        Use API keys to authenticate the CLI, MCP Server, and API calls.
      </p>

      {/* Create new key */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Create New Key</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., My Laptop, CI/CD)"
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={createKey}
            disabled={loading || !newKeyName.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition"
          >
            Create Key
          </button>
        </div>
      </div>

      {/* Show newly created key */}
      {createdKey && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 mb-6">
          <h3 className="text-green-400 font-semibold mb-2">
            Key Created - Copy It Now!
          </h3>
          <p className="text-gray-400 text-sm mb-3">
            This key will only be shown once. Save it somewhere safe.
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 px-4 py-2 bg-gray-800 rounded-lg text-green-400 font-mono text-sm select-all">
              {createdKey}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdKey);
              }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition"
            >
              Copy
            </button>
          </div>

          <div className="mt-4 space-y-2 text-sm text-gray-400">
            <p className="font-medium text-gray-300">Quick setup:</p>
            <div className="bg-gray-800 rounded-lg p-3 font-mono text-xs">
              <div className="text-gray-500"># CLI</div>
              <div>compressx login</div>
              <div className="mt-2 text-gray-500"># MCP Server (Claude Code / Cursor)</div>
              <div>{`"env": { "COMPRESSX_API_KEY": "${createdKey}" }`}</div>
            </div>
          </div>

          <button
            onClick={() => setCreatedKey(null)}
            className="mt-3 text-sm text-gray-500 hover:text-gray-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Key list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-400">Name</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-400">Key</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-400">Last Used</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-400">Created</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-gray-400"></th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No API keys yet. Create one above.
                </td>
              </tr>
            )}
            {keys.map((key) => (
              <tr key={key.id} className="border-b border-gray-800/50">
                <td className="px-6 py-3 text-white">{key.name}</td>
                <td className="px-6 py-3 text-gray-400 font-mono text-sm">
                  {key.keyPrefix}...
                </td>
                <td className="px-6 py-3 text-gray-500 text-sm">
                  {key.lastUsedAt
                    ? new Date(key.lastUsedAt).toLocaleDateString()
                    : "Never"}
                </td>
                <td className="px-6 py-3 text-gray-500 text-sm">
                  {new Date(key.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-3 text-right">
                  <button
                    onClick={() => revokeKey(key.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
