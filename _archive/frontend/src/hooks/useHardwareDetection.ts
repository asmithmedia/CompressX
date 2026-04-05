"use client";

import { useState, useEffect } from "react";

export interface HardwareInfo {
  /** System RAM in GB (from navigator.deviceMemory or performance.memory) */
  ramGb: number | null;
  /** CPU logical cores */
  cpuCores: number | null;
  /** GPU renderer string from WebGL (e.g., "NVIDIA GeForce RTX 3060") */
  gpuRenderer: string | null;
  /** GPU vendor */
  gpuVendor: string | null;
  /** Estimated VRAM in GB based on GPU model lookup */
  vramGb: number | null;
  /** Whether this is a dedicated GPU (not integrated) */
  hasDedicatedGpu: boolean;
  /** Recommended max model size in GB for this hardware */
  recommendedMaxModelGb: number;
  /** Whether detection completed */
  detected: boolean;
}

/** Known GPU VRAM sizes - maps renderer substrings to VRAM in GB */
const GPU_VRAM_TABLE: [string, number][] = [
  // NVIDIA Consumer
  ["RTX 5090", 32],
  ["RTX 5080", 16],
  ["RTX 5070 Ti", 16],
  ["RTX 5070", 12],
  ["RTX 5060 Ti", 16],
  ["RTX 5060", 8],
  ["RTX 4090", 24],
  ["RTX 4080 SUPER", 16],
  ["RTX 4080", 16],
  ["RTX 4070 Ti SUPER", 16],
  ["RTX 4070 Ti", 12],
  ["RTX 4070 SUPER", 12],
  ["RTX 4070", 12],
  ["RTX 4060 Ti", 16],
  ["RTX 4060", 8],
  ["RTX 3090 Ti", 24],
  ["RTX 3090", 24],
  ["RTX 3080 Ti", 12],
  ["RTX 3080", 12],
  ["RTX 3070 Ti", 8],
  ["RTX 3070", 8],
  ["RTX 3060 Ti", 8],
  ["RTX 3060", 12],
  ["RTX 3050", 8],
  ["RTX 2080 Ti", 11],
  ["RTX 2080 SUPER", 8],
  ["RTX 2080", 8],
  ["RTX 2070 SUPER", 8],
  ["RTX 2070", 8],
  ["RTX 2060 SUPER", 8],
  ["RTX 2060", 6],
  ["GTX 1660 Ti", 6],
  ["GTX 1660 SUPER", 6],
  ["GTX 1660", 6],
  ["GTX 1650", 4],
  ["GTX 1080 Ti", 11],
  ["GTX 1080", 8],
  ["GTX 1070 Ti", 8],
  ["GTX 1070", 8],
  ["GTX 1060", 6],
  ["GTX 1050 Ti", 4],
  ["GTX 1050", 2],
  // NVIDIA Pro / Data Center
  ["A100", 80],
  ["A6000", 48],
  ["A5000", 24],
  ["A4000", 16],
  ["A40", 48],
  ["A30", 24],
  ["A10", 24],
  ["L40S", 48],
  ["L40", 48],
  ["L4", 24],
  ["H100", 80],
  ["T4", 16],
  ["V100", 16],
  ["P100", 16],
  // AMD
  ["RX 7900 XTX", 24],
  ["RX 7900 XT", 20],
  ["RX 7800 XT", 16],
  ["RX 7700 XT", 12],
  ["RX 7600", 8],
  ["RX 6950 XT", 16],
  ["RX 6900 XT", 16],
  ["RX 6800 XT", 16],
  ["RX 6800", 16],
  ["RX 6700 XT", 12],
  ["RX 6600 XT", 8],
  // Apple Silicon (unified memory - VRAM = shared RAM)
  ["Apple M4 Ultra", 192],
  ["Apple M4 Max", 128],
  ["Apple M4 Pro", 48],
  ["Apple M4", 32],
  ["Apple M3 Ultra", 192],
  ["Apple M3 Max", 128],
  ["Apple M3 Pro", 36],
  ["Apple M3", 24],
  ["Apple M2 Ultra", 192],
  ["Apple M2 Max", 96],
  ["Apple M2 Pro", 32],
  ["Apple M2", 24],
  ["Apple M1 Ultra", 128],
  ["Apple M1 Max", 64],
  ["Apple M1 Pro", 32],
  ["Apple M1", 16],
];

function detectGpuVram(renderer: string): number | null {
  const upper = renderer.toUpperCase();
  for (const [name, vram] of GPU_VRAM_TABLE) {
    if (upper.includes(name.toUpperCase())) {
      return vram;
    }
  }
  return null;
}

function isDedicatedGpu(renderer: string): boolean {
  const r = renderer.toUpperCase();
  return (
    r.includes("NVIDIA") ||
    r.includes("GEFORCE") ||
    r.includes("RTX") ||
    r.includes("GTX") ||
    r.includes("RADEON") ||
    r.includes("RX ") ||
    r.includes("APPLE M")
  );
}

function getWebGLInfo(): { renderer: string | null; vendor: string | null } {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return { renderer: null, vendor: null };

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) {
      return {
        renderer: gl.getParameter(gl.RENDERER),
        vendor: gl.getParameter(gl.VENDOR),
      };
    }

    return {
      renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
      vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
    };
  } catch {
    return { renderer: null, vendor: null };
  }
}

function calculateRecommendedMaxModel(ramGb: number | null, vramGb: number | null): number {
  // For GPU inference (Ollama uses GPU by default):
  //   Model must fit in VRAM. Rule of thumb: model_size < VRAM * 0.85
  // For CPU-only inference:
  //   Model must fit in RAM. Rule of thumb: model_size < RAM * 0.6
  // We recommend based on whichever is available

  if (vramGb && vramGb >= 4) {
    // GPU inference: leave ~15% for KV cache and OS
    return Math.floor(vramGb * 0.85);
  }

  if (ramGb) {
    // CPU-only: leave room for OS and other processes
    return Math.floor(ramGb * 0.6);
  }

  // Default: assume 8 GB RAM, CPU-only
  return 4;
}

export function useHardwareDetection(): HardwareInfo {
  const [info, setInfo] = useState<HardwareInfo>({
    ramGb: null,
    cpuCores: null,
    gpuRenderer: null,
    gpuVendor: null,
    vramGb: null,
    hasDedicatedGpu: false,
    recommendedMaxModelGb: 4,
    detected: false,
  });

  useEffect(() => {
    // RAM detection
    const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory ?? null;
    // deviceMemory returns values like 0.25, 0.5, 1, 2, 4, 8
    // It caps at 8 on most browsers, so we'll note that limitation
    const ramGb = deviceMemory;

    // CPU cores
    const cpuCores = navigator.hardwareConcurrency ?? null;

    // GPU detection via WebGL
    const { renderer, vendor } = getWebGLInfo();
    const vramGb = renderer ? detectGpuVram(renderer) : null;
    const hasDedicatedGpu = renderer ? isDedicatedGpu(renderer) : false;

    // If deviceMemory is capped at 8 but we have lots of CPU cores,
    // the machine likely has more RAM. Use heuristic.
    let estimatedRam = ramGb;
    if (ramGb === 8 && cpuCores && cpuCores > 8) {
      // Likely 16+ GB machine
      estimatedRam = cpuCores >= 16 ? 32 : 16;
    }

    const recommendedMaxModelGb = calculateRecommendedMaxModel(estimatedRam, vramGb);

    setInfo({
      ramGb: estimatedRam,
      cpuCores,
      gpuRenderer: renderer,
      gpuVendor: vendor,
      vramGb,
      hasDedicatedGpu,
      recommendedMaxModelGb,
      detected: true,
    });
  }, []);

  return info;
}

/**
 * Given hardware constraints, recommend the best quantization type
 * for a model of a given parameter count.
 */
export function recommendQuantType(
  parametersBillion: number,
  maxModelSizeGb: number,
): { quantType: string; label: string; fitsInMemory: boolean; estimatedSizeGb: number }[] {
  const quantOptions = [
    { quantType: "q8_0", label: "Q8_0 (Best Quality)", bpw: 8.5 },
    { quantType: "q6_k", label: "Q6_K (Very High Quality)", bpw: 6.6 },
    { quantType: "q5_k_m", label: "Q5_K_M (High Quality)", bpw: 5.7 },
    { quantType: "q4_k_m", label: "Q4_K_M (Recommended)", bpw: 4.9 },
    { quantType: "q4_0", label: "Q4_0 (Good, Fast)", bpw: 4.5 },
    { quantType: "q3_k_m", label: "Q3_K_M (Smaller, Lower Quality)", bpw: 3.9 },
    { quantType: "q2_k", label: "Q2_K (Smallest, Noticeable Loss)", bpw: 3.35 },
  ];

  return quantOptions.map((opt) => {
    const estimatedSizeGb =
      (parametersBillion * 1e9 * opt.bpw) / 8 / 1e9 + 0.1;
    return {
      quantType: opt.quantType,
      label: opt.label,
      fitsInMemory: estimatedSizeGb <= maxModelSizeGb,
      estimatedSizeGb: Math.round(estimatedSizeGb * 100) / 100,
    };
  });
}
