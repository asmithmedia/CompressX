import chalk from "chalk";
import { detectHardware } from "../core/hardware-detect.js";

export async function hardwareCommand() {
  console.log(chalk.bold("\n  Hardware Detection\n"));

  const hw = await detectHardware();

  if (hw.gpuName) {
    console.log(`  GPU:      ${chalk.green(hw.gpuName)}`);
    if (hw.vramGb) {
      console.log(`  VRAM:     ${chalk.green(hw.vramGb + " GB")}`);
    }
  } else {
    console.log(`  GPU:      ${chalk.yellow("No dedicated GPU detected (CPU-only mode)")}`);
  }

  console.log(`  RAM:      ${chalk.cyan(hw.ramGb + " GB")}`);
  console.log(`  CPU:      ${chalk.cyan(hw.cpuCores + " cores")}`);
  console.log(`  Platform: ${chalk.gray(hw.platform)}`);
  console.log();

  console.log(chalk.bold("  Recommended Model Sizes:"));
  console.log(`    Best quality  (Q8_0):   up to ~${Math.floor(hw.maxModelGb * 0.6)} GB models`);
  console.log(`    Balanced      (Q4_K_M): up to ~${hw.maxModelGb} GB models`);
  console.log(`    Aggressive    (Q2_K):   up to ~${Math.floor(hw.maxModelGb * 1.4)} GB models`);
  console.log();
}
