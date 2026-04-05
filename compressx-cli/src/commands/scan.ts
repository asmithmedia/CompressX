import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { detectHardware } from "../core/hardware-detect.js";
import { isOllamaRunning, listOllamaModels, toCxName } from "../core/ollama-client.js";
import { resolveModel, recommendQuantType } from "../core/model-resolver.js";
import { compressCommand } from "./compress.js";

interface ScanOptions {
  all?: boolean;
  output?: string;
}

/**
 * Default command: scan Ollama library, suggest compressions, offer to compress.
 */
export async function scanCommand(options: ScanOptions = {}) {
  console.log(chalk.bold.cyan("\n  CompressX  ") + chalk.gray("- LLM Compression for Ollama\n"));

  // Check Ollama
  const ollamaSpinner = ora("Checking Ollama...").start();
  const ollamaUp = await isOllamaRunning();
  if (!ollamaUp) {
    ollamaSpinner.fail("Ollama is not running");
    console.log(chalk.yellow("\n  Start Ollama first:"));
    console.log(chalk.gray("    ollama serve\n"));
    console.log(chalk.gray("  Or compress a model directly:"));
    console.log(chalk.gray("    compressx compress qwen3:4b\n"));
    process.exit(1);
  }

  const installed = await listOllamaModels();
  ollamaSpinner.succeed(`Ollama running with ${installed.length} models`);

  // Detect hardware
  const hwSpinner = ora("Detecting hardware...").start();
  const hw = await detectHardware();
  hwSpinner.succeed(
    `${hw.gpuName || "CPU-only"} | ${hw.ramGb} GB RAM${hw.vramGb ? ` | ${hw.vramGb} GB VRAM` : ""} | max ~${hw.maxModelGb} GB models`
  );

  // Analyze which models could benefit from compression
  const candidates: Array<{
    installedName: string;
    currentSizeGb: number;
    currentQuant: string;
    model: ReturnType<typeof resolveModel>;
    cxName: string;
    targetQuant: string;
    targetSizeGb: number;
    savings: number;
    alreadyCompressed: boolean;
  }> = [];

  for (const m of installed) {
    if (m.name.endsWith("-cx")) continue; // Skip already-compressed
    const baseName = m.name.split(":")[0];
    const resolved = resolveModel(m.name) || resolveModel(baseName);
    if (!resolved || resolved.parametersBillion === 0) continue;

    const currentGb = m.size / 1e9;
    const recommended = recommendQuantType(resolved.parametersBillion, hw.maxModelGb);
    const cxName = toCxName(m.name);

    // Check if the -cx variant already exists
    const alreadyCompressed = installed.some((x) => x.name === cxName);

    // Skip if current is already smaller than what we'd produce
    if (currentGb <= recommended.estimatedSizeGb * 1.1) continue;

    candidates.push({
      installedName: m.name,
      currentSizeGb: currentGb,
      currentQuant: m.details?.quantization_level || "unknown",
      model: resolved,
      cxName,
      targetQuant: recommended.quantType,
      targetSizeGb: recommended.estimatedSizeGb,
      savings: currentGb - recommended.estimatedSizeGb,
      alreadyCompressed,
    });
  }

  candidates.sort((a, b) => b.savings - a.savings);

  console.log();

  if (candidates.length === 0) {
    console.log(chalk.green("  [OK] All your models are already well-sized for this hardware.\n"));
    console.log(chalk.gray("  To compress a specific model from HuggingFace:"));
    console.log(chalk.gray("    compressx compress qwen3:4b\n"));
    return;
  }

  console.log(chalk.bold(`  Found ${candidates.length} model${candidates.length > 1 ? "s" : ""} that could be smaller:\n`));

  // Display table
  const nameWidth = Math.max(20, ...candidates.map((c) => c.installedName.length + 2));
  console.log(
    chalk.gray(
      "  " +
        "Model".padEnd(nameWidth) +
        "Current".padEnd(12) +
        "->  CompressX".padEnd(18) +
        "Savings"
    )
  );
  console.log(chalk.gray("  " + "-".repeat(nameWidth + 45)));

  for (const c of candidates) {
    const savingsPct = Math.round((c.savings / c.currentSizeGb) * 100);
    const status = c.alreadyCompressed ? chalk.yellow("  (exists)") : "";
    console.log(
      "  " +
        chalk.white(c.installedName.padEnd(nameWidth)) +
        chalk.gray(`${c.currentSizeGb.toFixed(1)} GB`.padEnd(12)) +
        chalk.green(`${c.targetSizeGb.toFixed(1)} GB ${c.targetQuant.toUpperCase()}`.padEnd(18)) +
        chalk.cyan(`-${savingsPct}%`) +
        status
    );
  }

  console.log();

  // Filter out already-compressed unless --all
  const actionable = candidates.filter((c) => !c.alreadyCompressed);

  if (actionable.length === 0) {
    console.log(chalk.gray("  All suggestions already have -cx variants. Use --force to recompress.\n"));
    return;
  }

  // Interactive selection
  const { selected } = await inquirer.prompt<{ selected: string[] }>([
    {
      type: "checkbox",
      name: "selected",
      message: "Select models to compress:",
      choices: actionable.map((c) => ({
        name: `${c.installedName.padEnd(nameWidth)} ${chalk.gray(`${c.currentSizeGb.toFixed(1)} GB -> ${c.targetSizeGb.toFixed(1)} GB`)}`,
        value: c.installedName,
        checked: false,
      })),
    },
  ]);

  if (selected.length === 0) {
    console.log(chalk.gray("\n  Nothing selected. Exiting.\n"));
    return;
  }

  console.log();
  console.log(chalk.bold(`  Compressing ${selected.length} model${selected.length > 1 ? "s" : ""}...`));
  console.log(chalk.gray(`  Originals will be kept. New models will be registered as :${"<tag>"}-cx\n`));

  // Compress each selected model
  for (let i = 0; i < selected.length; i++) {
    const target = selected[i];
    console.log(chalk.bold.cyan(`\n  [${i + 1}/${selected.length}] ${target}`));
    try {
      await compressCommand(target, {
        quant: "",
        cloud: false,
        output: options.output || "./compressx-output",
        modelfile: true,
        json: false,
      });
    } catch (err) {
      console.error(chalk.red(`  Failed: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  console.log(chalk.green.bold("\n  [OK] All done!\n"));
  console.log(chalk.gray("  See your new models:"));
  console.log(chalk.cyan("    ollama list\n"));
}
