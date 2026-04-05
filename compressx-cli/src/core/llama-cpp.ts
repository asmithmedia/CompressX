import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";

export interface LlamaCppTools {
  convertScript: string | null;
  quantizeBinary: string | null;
}

function which(cmd: string): string | null {
  try {
    return execSync(`which ${cmd} 2>/dev/null || where ${cmd} 2>nul`, {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    })
      .trim()
      .split("\n")[0];
  } catch {
    return null;
  }
}

export async function findLlamaCpp(): Promise<LlamaCppTools> {
  const localBin = join(homedir(), ".compressx", "bin");
  const isWindows = platform() === "win32";
  const quantizeExe = isWindows ? "llama-quantize.exe" : "llama-quantize";

  // Find convert script
  let convertScript: string | null = null;
  const convertPaths = [
    which("convert_hf_to_gguf.py"),
    join(localBin, "convert_hf_to_gguf.py"),
    join(localBin, "llama-bin", "convert_hf_to_gguf.py"),
    "/usr/local/bin/convert_hf_to_gguf.py",
    "/opt/llama.cpp/convert_hf_to_gguf.py",
  ];
  for (const p of convertPaths) {
    if (p && existsSync(p)) {
      convertScript = p;
      break;
    }
  }

  // Find quantize binary. Check common locations including nested layouts
  // from llama.cpp release zips (e.g. llama-bin/ or build/bin/).
  let quantizeBinary: string | null = null;
  const quantizePaths = [
    which("llama-quantize"),
    which("quantize"),
    join(localBin, quantizeExe),
    join(localBin, "llama-bin", quantizeExe),
    join(localBin, "build", "bin", quantizeExe),
    "/usr/local/bin/llama-quantize",
    "/opt/llama.cpp/build/bin/llama-quantize",
  ];
  for (const p of quantizePaths) {
    if (p && existsSync(p)) {
      quantizeBinary = p;
      break;
    }
  }

  return { convertScript, quantizeBinary };
}
