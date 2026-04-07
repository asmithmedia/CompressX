import chalk from "chalk";
import { detectHardware } from "../core/hardware-detect.js";
import { resolveModel } from "../core/model-resolver.js";
import { isThinkingModel } from "../core/ollama-client.js";
import { calculateVramBudget, formatContext } from "../core/vram-optimizer.js";

const UNSAFE_QUANTS_FOR_THINKING = new Set(["q2_k", "iq2_xxs", "iq2_xs", "q3_k_s"]);

/**
 * What-if mode: show all quant levels for a model side-by-side, with
 * estimated size, reduction %, and whether each fits the user's VRAM.
 * No download, no compression, no deployment — pure simulation.
 */
export async function previewCommand(modelId: string) {
  const model = resolveModel(modelId);
  if (!model) {
    console.error(chalk.red(`\n  Unknown model: ${modelId}`));
    console.log(chalk.gray("  Run 'compressx models' to see supported models\n"));
    process.exit(1);
  }

  if (model.parametersBillion === 0) {
    console.error(chalk.red(`\n  Custom repositories don't have size metadata for preview.`));
    console.log(chalk.gray("  Use 'compressx compress <model>' to compress directly.\n"));
    process.exit(1);
  }

  const hw = await detectHardware();
  const thinking = await isThinkingModel(model.ollamaId);

  console.log(chalk.bold.cyan(`\n  CompressX Preview: ${model.name}`));
  console.log(chalk.gray(`  ${"-".repeat(60)}`));
  console.log(`  Source:        ${chalk.gray(model.hfRepoId)}`);
  console.log(`  Parameters:    ${chalk.gray(model.parametersBillion + "B")}`);
  console.log(`  Original FP16: ${chalk.gray("~" + model.fp16SizeGb + " GB")}`);
  if (thinking) {
    console.log(`  Type:          ${chalk.magenta("reasoning model (has thinking capability)")}`);
  }
  console.log();
  console.log(
    `  Your hardware: ${chalk.white(hw.gpuName || "CPU-only")}${hw.vramGb ? chalk.gray(` | ${hw.vramGb} GB VRAM`) : ""}${chalk.gray(` | ${hw.ramGb} GB RAM`)}`,
  );
  console.log(`  Max recommended model size: ${chalk.white("~" + hw.maxModelGb + " GB")}`);
  console.log();

  // All quant levels, ordered from best quality to most aggressive
  const QUANT_LEVELS: Array<{
    quant: string;
    bpw: number;
    label: string;
  }> = [
    { quant: "f16", bpw: 16, label: "Baseline (uncompressed)" },
    { quant: "q8_0", bpw: 8.5, label: "Best" },
    { quant: "q6_k", bpw: 6.6, label: "Very high" },
    { quant: "q5_k_m", bpw: 5.7, label: "High" },
    { quant: "q4_k_m", bpw: 4.9, label: "Recommended" },
    { quant: "q4_0", bpw: 4.5, label: "Good, fast" },
    { quant: "q3_k_m", bpw: 3.9, label: "Fair" },
    { quant: "q2_k", bpw: 3.35, label: "Reduced" },
  ];

  // Header
  const showCtx = hw.vramGb != null;
  const header = showCtx
    ? "  Quant Type   Size      Reduction   Fits VRAM?   Max Ctx   Quality"
    : "  Quant Type   Size      Reduction   Fits VRAM?   Quality";
  console.log(chalk.gray(header));
  console.log(chalk.gray("  " + "-".repeat(showCtx ? 80 : 70)));

  let bestFit: string | null = null;

  for (const row of QUANT_LEVELS) {
    const sizeGb = (model.parametersBillion * 1e9 * row.bpw) / 8 / 1e9 + 0.1;
    const reduction = Math.round(((model.fp16SizeGb - sizeGb) / model.fp16SizeGb) * 100);
    const unsafeForThinking = thinking && UNSAFE_QUANTS_FOR_THINKING.has(row.quant);

    let fits: string;
    if (!hw.vramGb && !hw.ramGb) {
      fits = chalk.gray("[?]");
    } else {
      const maxGb = hw.maxModelGb;
      if (sizeGb <= maxGb * 0.9) {
        fits = chalk.green("[YES]");
        if (!bestFit && !unsafeForThinking) bestFit = row.quant;
      } else if (sizeGb <= maxGb) {
        fits = chalk.yellow("[TIGHT]");
        if (!bestFit && !unsafeForThinking) bestFit = row.quant;
      } else {
        fits = chalk.red("[NO]");
      }
    }

    // Calculate max context for this quant level
    let ctxCol = "";
    if (showCtx) {
      const budget = calculateVramBudget(
        sizeGb,
        hw.vramGb,
        model.family,
        model.parametersBillion,
      );
      ctxCol = budget
        ? chalk.white(formatContext(budget.maxContext).padEnd(9))
        : chalk.gray("--".padEnd(9));
    }

    const quantCol = chalk.cyan(row.quant.padEnd(10));
    const sizeCol = chalk.white(`${sizeGb.toFixed(1)} GB`.padEnd(9));
    const reductionCol =
      reduction > 0
        ? chalk.green(`-${reduction}%`.padEnd(11))
        : chalk.gray(" 0%".padEnd(11));
    const fitsCol = fits.padEnd(12 + 9);
    const qualityCol = unsafeForThinking
      ? chalk.red(`${row.label} — breaks reasoning`)
      : chalk.gray(row.label);

    const line = showCtx
      ? `  ${quantCol}   ${sizeCol} ${reductionCol} ${fitsCol} ${ctxCol} ${qualityCol}`
      : `  ${quantCol}   ${sizeCol} ${reductionCol} ${fitsCol} ${qualityCol}`;
    console.log(line);
  }

  console.log();

  if (thinking) {
    console.log(
      chalk.magenta(
        "  Note: This is a reasoning model. Q2_K / Q3_K_S break chain-of-thought",
      ),
    );
    console.log(
      chalk.magenta("        output. Q4_0 is the recommended floor for thinking models."),
    );
    console.log();
  }

  if (bestFit) {
    console.log(chalk.bold("  To compress with the best quant for your hardware:"));
    console.log(chalk.cyan(`    compressx compress ${model.ollamaId} -q ${bestFit}`));
  } else {
    console.log(chalk.yellow("  This model is too large for your hardware at any safe quant level."));
    console.log(chalk.gray("  Consider a smaller model family or a machine with more VRAM."));
  }

  console.log();
  console.log(chalk.gray("  Deploy to any GGUF-compatible runtime with --target:"));
  console.log(chalk.gray("    --target ollama    (default)"));
  console.log(chalk.gray("    --target lmstudio  (LM Studio)"));
  console.log(chalk.gray("    --target gguf      (llama.cpp, Jan, GPT4All, Msty, etc.)"));
  console.log();
}
