"use client";

import { useState, useEffect } from "react";

type OsKey = "macos" | "linux" | "windows" | "npm";

interface InstallOption {
  key: OsKey;
  label: string;
  icon: string;
  command: string;
  note: string;
  requirement: string;
}

const OPTIONS: InstallOption[] = [
  {
    key: "macos",
    label: "macOS",
    icon: "",
    command: "curl -fsSL https://compressx.asmith.media/install.sh | sh",
    note: "Installs CompressX and downloads llama.cpp tools automatically.",
    requirement: "Requires Node.js 18+ and Python 3.11+",
  },
  {
    key: "linux",
    label: "Linux",
    icon: "",
    command: "curl -fsSL https://compressx.asmith.media/install.sh | sh",
    note: "Works on Ubuntu, Debian, Fedora, Arch, and other distros.",
    requirement: "Requires Node.js 18+ and Python 3.11+",
  },
  {
    key: "windows",
    label: "Windows",
    icon: "",
    command: `powershell -c "irm https://compressx.asmith.media/install.ps1 | iex"`,
    note: "Works from any terminal (cmd, PowerShell, Windows Terminal).",
    requirement: "Requires Node.js 18+ and Python 3.11+",
  },
  {
    key: "npm",
    label: "npm",
    icon: "",
    command: "npm install -g compressx",
    note: "Universal install via npm. Works on any OS with Node.js.",
    requirement: "Requires Node.js 18+",
  },
];

function detectOs(): OsKey {
  if (typeof navigator === "undefined") return "npm";
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || "").toLowerCase();
  if (platform.includes("mac") || ua.includes("mac os") || ua.includes("macintosh"))
    return "macos";
  if (platform.includes("win") || ua.includes("windows")) return "windows";
  if (platform.includes("linux") || ua.includes("linux") || ua.includes("x11"))
    return "linux";
  return "npm";
}

export function InstallTabs() {
  const [active, setActive] = useState<OsKey>("npm");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setActive(detectOs());
  }, []);

  const current = OPTIONS.find((o) => o.key === active) || OPTIONS[3];

  function copy() {
    navigator.clipboard.writeText(current.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Tabs */}
      <div className="flex gap-1 mb-3 bg-gray-900 border border-gray-800 rounded-lg p-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setActive(opt.key)}
            className={`flex-1 py-2 px-3 text-sm rounded-md transition font-sans ${
              active === opt.key
                ? "bg-black text-white border border-gray-700"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Command box */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-1">
        <div className="flex items-center justify-between bg-black rounded-md px-4 py-3">
          <code className="text-sm text-green-400 text-left overflow-x-auto whitespace-nowrap flex-1">
            <span className="text-gray-600 select-none">$ </span>
            {current.command}
          </code>
          <button
            onClick={copy}
            className="ml-4 flex-shrink-0 text-xs text-gray-500 hover:text-white transition font-sans"
            aria-label="Copy install command"
          >
            {copied ? "✓ copied" : "copy"}
          </button>
        </div>
      </div>

      {/* Helper text */}
      <div className="mt-3 text-center font-sans">
        <p className="text-xs text-gray-500">{current.note}</p>
        <p className="text-[10px] text-gray-600 mt-1">{current.requirement}</p>
      </div>
    </div>
  );
}
