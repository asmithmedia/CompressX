import { execSync } from "child_process";
import { cpus, totalmem, platform } from "os";

export interface HardwareInfo {
  gpuName: string | null;
  vramGb: number | null;
  ramGb: number;
  cpuCores: number;
  platform: string;
  maxModelGb: number;
}

const GPU_VRAM: Record<string, number> = {
  "RTX 5090": 32, "RTX 5080": 16, "RTX 5070": 12,
  "RTX 4090": 24, "RTX 4080": 16, "RTX 4070 TI": 12, "RTX 4070": 12, "RTX 4060 TI": 16, "RTX 4060": 8,
  "RTX 3090": 24, "RTX 3080": 12, "RTX 3070": 8, "RTX 3060": 12, "RTX 3050": 8,
  "RTX 2080 TI": 11, "RTX 2080": 8, "RTX 2070": 8, "RTX 2060": 6,
  "GTX 1080 TI": 11, "GTX 1080": 8, "GTX 1070": 8, "GTX 1060": 6,
  "A100": 80, "A6000": 48, "H100": 80, "L40S": 48, "T4": 16, "V100": 16,
  "RX 7900 XTX": 24, "RX 7800 XT": 16,
  "M4 ULTRA": 192, "M4 MAX": 128, "M4 PRO": 48, "M4": 32,
  "M3 MAX": 128, "M3 PRO": 36, "M3": 24,
  "M2 ULTRA": 192, "M2 MAX": 96, "M2 PRO": 32, "M2": 24,
  "M1 ULTRA": 128, "M1 MAX": 64, "M1 PRO": 32, "M1": 16,
};

function lookupVram(gpuName: string): number | null {
  const upper = gpuName.toUpperCase();
  for (const [key, vram] of Object.entries(GPU_VRAM)) {
    if (upper.includes(key)) return vram;
  }
  return null;
}

function detectNvidiaGpu(): { name: string; vram: number | null } | null {
  try {
    const output = execSync(
      "nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits",
      { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }
    ).trim();

    if (!output) return null;
    const [name, memMb] = output.split(",").map((s) => s.trim());
    const vram = memMb ? Math.round(parseInt(memMb) / 1024) : lookupVram(name);
    return { name, vram };
  } catch {
    return null;
  }
}

function detectAppleSilicon(): { name: string; vram: number | null } | null {
  if (platform() !== "darwin") return null;
  try {
    const output = execSync("sysctl -n machdep.cpu.brand_string", {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (output.includes("Apple")) {
      const vram = lookupVram(output);
      // Apple Silicon uses unified memory
      return { name: output, vram: vram || Math.floor(totalmem() / 1e9) };
    }
    return null;
  } catch {
    return null;
  }
}

export async function detectHardware(): Promise<HardwareInfo> {
  const ramGb = Math.round(totalmem() / 1e9);
  const cpuCores = cpus().length;
  const os = platform();

  // Try NVIDIA first, then Apple Silicon
  const nvidia = detectNvidiaGpu();
  const apple = !nvidia ? detectAppleSilicon() : null;
  const gpu = nvidia || apple;

  const gpuName = gpu?.name || null;
  const vramGb = gpu?.vram || null;

  // Calculate max model size
  let maxModelGb: number;
  if (vramGb && vramGb >= 4) {
    maxModelGb = Math.floor(vramGb * 0.85);
  } else {
    maxModelGb = Math.floor(ramGb * 0.6);
  }

  return { gpuName, vramGb, ramGb, cpuCores, platform: os, maxModelGb };
}
