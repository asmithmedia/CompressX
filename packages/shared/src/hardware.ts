/** Known GPU VRAM sizes - maps renderer substrings to VRAM in GB */
export const GPU_VRAM_TABLE: [string, number][] = [
  ["RTX 5090", 32], ["RTX 5080", 16], ["RTX 5070 Ti", 16], ["RTX 5070", 12],
  ["RTX 4090", 24], ["RTX 4080", 16], ["RTX 4070 Ti", 12], ["RTX 4070", 12], ["RTX 4060 Ti", 16], ["RTX 4060", 8],
  ["RTX 3090", 24], ["RTX 3080 Ti", 12], ["RTX 3080", 12], ["RTX 3070 Ti", 8], ["RTX 3070", 8], ["RTX 3060 Ti", 8], ["RTX 3060", 12], ["RTX 3050", 8],
  ["RTX 2080 Ti", 11], ["RTX 2080", 8], ["RTX 2070", 8], ["RTX 2060", 6],
  ["GTX 1080 Ti", 11], ["GTX 1080", 8], ["GTX 1070", 8], ["GTX 1060", 6], ["GTX 1050 Ti", 4],
  ["A100", 80], ["A6000", 48], ["A5000", 24], ["A4000", 16], ["H100", 80], ["L40S", 48], ["L4", 24], ["T4", 16], ["V100", 16],
  ["RX 7900 XTX", 24], ["RX 7900 XT", 20], ["RX 7800 XT", 16], ["RX 7600", 8],
  ["Apple M4 Ultra", 192], ["Apple M4 Max", 128], ["Apple M4 Pro", 48], ["Apple M4", 32],
  ["Apple M3 Max", 128], ["Apple M3 Pro", 36], ["Apple M3", 24],
  ["Apple M2 Ultra", 192], ["Apple M2 Max", 96], ["Apple M2 Pro", 32], ["Apple M2", 24],
  ["Apple M1 Ultra", 128], ["Apple M1 Max", 64], ["Apple M1 Pro", 32], ["Apple M1", 16],
];

export function lookupVram(gpuName: string): number | null {
  const upper = gpuName.toUpperCase();
  for (const [name, vram] of GPU_VRAM_TABLE) {
    if (upper.includes(name.toUpperCase())) return vram;
  }
  return null;
}

export interface QuantRecommendation {
  quantType: string;
  label: string;
  bitsPerWeight: number;
  estimatedSizeGb: number;
  fitsInMemory: boolean;
}

const QUANT_OPTIONS = [
  { quantType: "q8_0", label: "Q8_0 (Best Quality)", bpw: 8.5 },
  { quantType: "q6_k", label: "Q6_K (Very High Quality)", bpw: 6.6 },
  { quantType: "q5_k_m", label: "Q5_K_M (High Quality)", bpw: 5.7 },
  { quantType: "q4_k_m", label: "Q4_K_M (Recommended)", bpw: 4.9 },
  { quantType: "q4_0", label: "Q4_0 (Good, Fast)", bpw: 4.5 },
  { quantType: "q3_k_m", label: "Q3_K_M (Smaller)", bpw: 3.9 },
  { quantType: "q2_k", label: "Q2_K (Smallest)", bpw: 3.35 },
];

export function estimateCompressedSize(parametersBillion: number, quantType: string): number {
  const bpwMap: Record<string, number> = {
    f16: 16, q8_0: 8.5, q6_k: 6.6, q5_k_m: 5.7, q5_0: 5.5,
    q4_k_m: 4.9, q4_k_s: 4.6, q4_0: 4.5, q3_k_m: 3.9, q3_k_s: 3.5,
    q2_k: 3.35, iq2_xxs: 2.06,
  };
  const bpw = bpwMap[quantType] || 4.9;
  return Math.round(((parametersBillion * 1e9 * bpw) / 8 / 1e9 + 0.1) * 100) / 100;
}

export function recommendQuantType(
  parametersBillion: number,
  maxModelSizeGb: number
): QuantRecommendation[] {
  return QUANT_OPTIONS.map((opt) => {
    const estimatedSizeGb = estimateCompressedSize(parametersBillion, opt.quantType);
    return {
      quantType: opt.quantType,
      label: opt.label,
      bitsPerWeight: opt.bpw,
      estimatedSizeGb,
      fitsInMemory: estimatedSizeGb <= maxModelSizeGb,
    };
  });
}

export function calculateRecommendedMaxModel(ramGb: number | null, vramGb: number | null): number {
  if (vramGb && vramGb >= 4) return Math.floor(vramGb * 0.85);
  if (ramGb) return Math.floor(ramGb * 0.6);
  return 4;
}
