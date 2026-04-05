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

interface Candidate {
  installedName: string;
  currentSizeGb: number;
  currentQuant: string;
  parametersBillion: number;
  cxName: string;
  targetQuant: string;
  targetSizeGb: number;
  savings: number;
  savingsPct: number;
  alreadyCompressed: boolean;
  fitsWell: boolean; // true if current size is already within 110% of the recommendation
}

/**
 * Default command: scan Ollama library, suggest compressions, offer to compress.
 *
 * Two modes:
 *   - Default: show models where compression would meaningfully help
 *     (filter: currentGb > recommended * 1.1). If the filter excludes
 *     everything, interactively offer to switch to --all mode instead of
 *     showing a dead-end.
 *   - --all: show every installed Ollama model (minus already-cx variants).
 *     Useful when users on well-equipped hardware want to compress anyway.
 */
export async function scanCommand(options: ScanOptions = {}) {
  console.log(chalk.bold.cyan("\n  CompressX  ") + chalk.gray("- LLM Compression for Ollama\n"));

  const ollamaSpinner = ora("Checking Ollama...").start();
  const ollamaUp = await isOllamaRunning();
  if (!ollamaUp) {
    ollamaSpinner.fail("Ollama is not running");
    console.log(chalk.yellow("\n  Start Ollama first:"));
    console.log(chalk.gray("    ollama serve\n"));
    console.log(chalk.gray("  Or compress a model directly:"));
    console.log(chalk.gray("    compressx compress qwen3:4b\n"));
    console.log(chalk.gray("  Or preview without compressing:"));
    console.log(chalk.gray("    compressx preview qwen3:4b\n"));
    process.exit(1);
  }

  const installed = await listOllamaModels();
  ollamaSpinner.succeed(`Ollama running with ${installed.length} models`);

  const hwSpinner = ora("Detecting hardware...").start();
  const hw = await detectHardware();
  hwSpinner.succeed(
    `${hw.gpuName || "CPU-only"} | ${hw.ramGb} GB RAM${hw.vramGb ? ` | ${hw.vramGb} GB VRAM` : ""} | max ~${hw.maxModelGb} GB models`,
  );

  // Build the full list of candidates — every resolvable installed model,
  // with metadata for both "needs compression" and "already fits well" states.
  const all: Candidate[] = [];

  for (const m of installed) {
    if (m.name.endsWith("-cx")) continue; // Skip our own outputs
    const baseName = m.name.split(":")[0];
    const resolved = resolveModel(m.name) || resolveModel(baseName);
    if (!resolved || resolved.parametersBillion === 0) continue;

    const currentGb = m.size / 1e9;
    const recommended = recommendQuantType(resolved.parametersBillion, hw.maxModelGb);
    const cxName = toCxName(m.name);
    const alreadyCompressed = installed.some((x) => x.name === cxName);
    const savings = Math.max(0, currentGb - recommended.estimatedSizeGb);
    const savingsPct = currentGb > 0 ? Math.round((savings / currentGb) * 100) : 0;
    const fitsWell = currentGb <= recommended.estimatedSizeGb * 1.1;

    all.push({
      installedName: m.name,
      currentSizeGb: currentGb,
      currentQuant: m.details?.quantization_level || "unknown",
      parametersBillion: resolved.parametersBillion,
      cxName,
      targetQuant: recommended.quantType,
      targetSizeGb: recommended.estimatedSizeGb,
      savings,
      savingsPct,
      alreadyCompressed,
      fitsWell,
    });
  }

  if (all.length === 0) {
    console.log();
    console.log(chalk.yellow("  No resolvable models found in your Ollama library."));
    console.log(chalk.gray("  (CompressX only knows a set of supported model families.)"));
    console.log(chalk.gray("\n  Run 'compressx models' to see the full list."));
    console.log(chalk.gray("  Or compress a specific HuggingFace repo:"));
    console.log(chalk.gray("    compressx compress Qwen/Qwen3-4B\n"));
    return;
  }

  // Decide the view:
  //   --all: show everything
  //   default: show only candidates that meaningfully benefit from compression
  let showAll = options.all === true;
  let visible = showAll ? all : all.filter((c) => !c.fitsWell);

  // If the default filter removed everything, offer the fallback
  if (!showAll && visible.length === 0) {
    console.log();
    console.log(
      chalk.green("  [OK] Your models are already well-sized for this hardware."),
    );
    console.log();

    const { exploreAll } = await inquirer.prompt<{ exploreAll: boolean }>([
      {
        type: "confirm",
        name: "exploreAll",
        message: "Explore all installed models anyway?",
        default: false,
      },
    ]);

    if (!exploreAll) {
      console.log(chalk.gray("\n  Tip: 'compressx preview <model>' shows quant trade-offs"));
      console.log(chalk.gray("       without compressing anything.\n"));
      return;
    }

    showAll = true;
    visible = all;
  }

  // Sort: actionable (fits-well = false) first, biggest savings first,
  // then fits-well entries at the bottom.
  visible.sort((a, b) => {
    if (a.fitsWell !== b.fitsWell) return a.fitsWell ? 1 : -1;
    return b.savings - a.savings;
  });

  console.log();
  const headline = showAll
    ? `  Installed models (${visible.length}):`
    : `  Found ${visible.length} model${visible.length > 1 ? "s" : ""} that could be smaller:`;
  console.log(chalk.bold(headline));
  console.log();

  // Table
  const nameWidth = Math.max(20, ...visible.map((c) => c.installedName.length + 2));
  console.log(
    chalk.gray(
      "  " +
        "Model".padEnd(nameWidth) +
        "Current".padEnd(12) +
        "->  CompressX".padEnd(18) +
        "Savings  Status",
    ),
  );
  console.log(chalk.gray("  " + "-".repeat(nameWidth + 55)));

  for (const c of visible) {
    let status: string;
    if (c.alreadyCompressed) {
      status = chalk.yellow("(already has -cx)");
    } else if (c.fitsWell) {
      status = chalk.gray("fits well");
    } else {
      status = chalk.green("suggested");
    }

    const rowColor = c.fitsWell ? chalk.gray : chalk.white;
    console.log(
      "  " +
        rowColor(c.installedName.padEnd(nameWidth)) +
        chalk.gray(`${c.currentSizeGb.toFixed(1)} GB`.padEnd(12)) +
        (c.fitsWell ? chalk.gray : chalk.green)(
          `${c.targetSizeGb.toFixed(1)} GB ${c.targetQuant.toUpperCase()}`.padEnd(18),
        ) +
        (c.fitsWell ? chalk.gray : chalk.cyan)(`-${c.savingsPct}%`.padEnd(9)) +
        status,
    );
  }

  console.log();

  // Actionable = everything not already compressed
  const actionable = visible.filter((c) => !c.alreadyCompressed);

  if (actionable.length === 0) {
    console.log(
      chalk.gray("  All models already have -cx variants. Use --force to recompress.\n"),
    );
    return;
  }

  // Interactive checkbox
  const { selected } = await inquirer.prompt<{ selected: string[] }>([
    {
      type: "checkbox",
      name: "selected",
      message: "Select models to compress:",
      choices: actionable.map((c) => ({
        name:
          `${c.installedName.padEnd(nameWidth)} ` +
          chalk.gray(`${c.currentSizeGb.toFixed(1)} GB -> ${c.targetSizeGb.toFixed(1)} GB`) +
          (c.fitsWell ? chalk.gray("  (fits well)") : ""),
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
  console.log(
    chalk.bold(`  Compressing ${selected.length} model${selected.length > 1 ? "s" : ""}...`),
  );
  console.log(
    chalk.gray(`  Originals will be kept. New models will be registered as :<tag>-cx\n`),
  );

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
        target: "ollama",
      });
    } catch (err) {
      console.error(chalk.red(`  Failed: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  console.log(chalk.green.bold("\n  [OK] All done!\n"));
  console.log(chalk.gray("  See your new models:"));
  console.log(chalk.cyan("    ollama list\n"));
}
