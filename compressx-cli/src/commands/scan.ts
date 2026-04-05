import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";

const Separator = inquirer.Separator;
const EXIT_VALUE = "__compressx_exit__";
import { detectHardware } from "../core/hardware-detect.js";
import { isOllamaRunning, listOllamaModels, toCxName } from "../core/ollama-client.js";
import { resolveModel, recommendQuantType } from "../core/model-resolver.js";
import { compressCommand } from "./compress.js";

interface ScanOptions {
  all?: boolean;
  preview?: boolean;
  output?: string;
}

interface Candidate {
  installedName: string;
  currentSizeGb: number;
  currentQuant: string;
  parametersBillion: number;
  cxName: string;
  /** Recommended quant for the hardware (best quality that fits) */
  targetQuant: string;
  targetSizeGb: number;
  savings: number;
  savingsPct: number;
  /** Most aggressive quant (Q2_K) — used for the "what if" comparison
   *  when the hardware-recommended quant isn't smaller than what's
   *  already installed. This is the "absolute maximum savings" line. */
  aggressiveQuant: string;
  aggressiveSizeGb: number;
  aggressiveSavings: number;
  aggressiveSavingsPct: number;
  alreadyCompressed: boolean;
  fitsWell: boolean;
}

/** Bits-per-weight for the most aggressive quant we ship. */
const AGGRESSIVE_BPW = 3.35; // Q2_K
const AGGRESSIVE_QUANT = "q2_k";

function estimateAggressiveSize(parametersBillion: number): number {
  return Math.round(((parametersBillion * 1e9 * AGGRESSIVE_BPW) / 8 / 1e9 + 0.1) * 100) / 100;
}

/**
 * Default command: scan Ollama library, show compression opportunities,
 * and offer to compress interactively.
 *
 * Modes:
 *   - Default: show models where compression would meaningfully help.
 *     If everything is already well-sized, show a library-wide preview
 *     of potential savings with aggressive quantization instead of a
 *     dead-end.
 *   - --all: show every installed Ollama model, regardless of current fit.
 *   - --preview: show the library-wide comparison table only (no compression
 *     prompt). Useful for "what if" exploration.
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

  const all: Candidate[] = [];

  for (const m of installed) {
    if (m.name.endsWith("-cx")) continue;
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

    const aggressiveSizeGb = estimateAggressiveSize(resolved.parametersBillion);
    const aggressiveSavings = Math.max(0, currentGb - aggressiveSizeGb);
    const aggressiveSavingsPct =
      currentGb > 0 ? Math.round((aggressiveSavings / currentGb) * 100) : 0;

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
      aggressiveQuant: AGGRESSIVE_QUANT,
      aggressiveSizeGb,
      aggressiveSavings,
      aggressiveSavingsPct,
      alreadyCompressed,
      fitsWell,
    });
  }

  if (all.length === 0) {
    console.log();
    console.log(chalk.yellow("  None of your installed models are in the CompressX registry."));
    console.log(chalk.gray("  (We only know a set of supported model families so far.)"));
    console.log(chalk.gray("\n  Run 'compressx models' to see the full list."));
    console.log(chalk.gray("  Or compress any model by name or repository path:"));
    console.log(chalk.gray("    compressx compress qwen3:4b"));
    console.log(chalk.gray("    compressx compress Qwen/Qwen3-4B\n"));
    return;
  }

  // --preview: show the library-wide comparison table and exit. No prompts.
  if (options.preview) {
    printLibraryPreview(all);
    return;
  }

  const showAll = options.all === true;
  const visible = showAll ? all : all.filter((c) => !c.fitsWell);

  // If the default filter removed everything, show the library-wide
  // "what compression would save" view with an inline checkbox picker.
  if (!showAll && visible.length === 0) {
    console.log();
    console.log(
      chalk.green("  [OK] All your models already fit your hardware well."),
    );
    console.log();
    console.log(
      chalk.white(`  Here's what aggressive compression (${AGGRESSIVE_QUANT.toUpperCase()}) could still save:`),
    );
    console.log();

    // Sort by biggest aggressive savings first
    const sorted = [...all].sort((a, b) => b.aggressiveSavings - a.aggressiveSavings);

    const nameWidth = Math.max(20, ...sorted.map((c) => c.installedName.length + 2));
    console.log(
      chalk.gray(
        "  " +
          "Model".padEnd(nameWidth) +
          "Current".padEnd(12) +
          `${AGGRESSIVE_QUANT.toUpperCase()}`.padEnd(10) +
          "Savings",
      ),
    );
    console.log(chalk.gray("  " + "-".repeat(nameWidth + 35)));

    for (const c of sorted) {
      console.log(
        "  " +
          chalk.white(c.installedName.padEnd(nameWidth)) +
          chalk.gray(`${c.currentSizeGb.toFixed(1)} GB`.padEnd(12)) +
          chalk.cyan(`${c.aggressiveSizeGb.toFixed(1)} GB`.padEnd(10)) +
          chalk.green(`-${c.aggressiveSavingsPct}%`) +
          (c.alreadyCompressed ? chalk.yellow("  (already has -cx)") : ""),
      );
    }

    console.log();
    console.log(
      chalk.gray("  Quality: Q2_K is the smallest quant — noticeable quality loss on some tasks."),
    );
    console.log(
      chalk.gray("  Tip: 'compressx preview <model>' shows every quant level for one model."),
    );
    console.log();

    const selectable = sorted.filter((c) => !c.alreadyCompressed);
    if (selectable.length === 0) {
      console.log(chalk.gray("  All models already have -cx variants.\n"));
      return;
    }

    const { selected } = await inquirer.prompt<{ selected: string[] }>([
      {
        type: "checkbox",
        name: "selected",
        message: `Compress any of these to ${AGGRESSIVE_QUANT.toUpperCase()} anyway?`,
        choices: [
          ...selectable.map((c) => ({
            name:
              `${c.installedName.padEnd(nameWidth)} ` +
              chalk.gray(
                `${c.currentSizeGb.toFixed(1)} GB -> ${c.aggressiveSizeGb.toFixed(1)} GB`,
              ) +
              chalk.cyan(` (-${c.aggressiveSavingsPct}%)`),
            value: c.installedName,
            checked: false,
          })),
          new Separator(" "),
          {
            name: chalk.gray("Exit without changes"),
            value: EXIT_VALUE,
            checked: false,
          },
        ],
      },
    ]);

    if (selected.length === 0 || selected.includes(EXIT_VALUE)) {
      console.log(chalk.gray("\n  Exiting. No models were changed.\n"));
      return;
    }

    await runCompressions(
      selected.filter((v) => v !== EXIT_VALUE),
      AGGRESSIVE_QUANT,
      options.output,
    );
    return;
  }

  // Normal flow: show candidates, then checkbox picker at the recommended quant.
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

  const actionable = visible.filter((c) => !c.alreadyCompressed);
  if (actionable.length === 0) {
    console.log(chalk.gray("  All models already have -cx variants. Use --force to recompress.\n"));
    return;
  }

  const { selected } = await inquirer.prompt<{ selected: string[] }>([
    {
      type: "checkbox",
      name: "selected",
      message: "Select models to compress:",
      choices: [
        ...actionable.map((c) => ({
          name:
            `${c.installedName.padEnd(nameWidth)} ` +
            chalk.gray(`${c.currentSizeGb.toFixed(1)} GB -> ${c.targetSizeGb.toFixed(1)} GB`) +
            (c.fitsWell ? chalk.gray("  (fits well)") : ""),
          value: c.installedName,
          checked: false,
        })),
        new Separator(" "),
        {
          name: chalk.gray("Exit without changes"),
          value: EXIT_VALUE,
          checked: false,
        },
      ],
    },
  ]);

  if (selected.length === 0 || selected.includes(EXIT_VALUE)) {
    console.log(chalk.gray("\n  Exiting. No models were changed.\n"));
    return;
  }

  // Use the recommended quant for each model in normal mode
  await runCompressions(
    selected.filter((v) => v !== EXIT_VALUE),
    "",
    options.output,
  );
}

/**
 * Library-wide preview: show every resolvable model with its current
 * size and what it would look like at every useful quant level. No
 * prompts, no compression — pure "what if" data.
 */
function printLibraryPreview(all: Candidate[]) {
  console.log();
  console.log(chalk.bold("  Library preview — what compression would do for every model:"));
  console.log();

  const sorted = [...all].sort((a, b) => b.currentSizeGb - a.currentSizeGb);
  const nameWidth = Math.max(20, ...sorted.map((c) => c.installedName.length + 2));

  console.log(
    chalk.gray(
      "  " +
        "Model".padEnd(nameWidth) +
        "Current".padEnd(12) +
        "Q4_K_M".padEnd(11) +
        "Q3_K_M".padEnd(11) +
        "Q2_K".padEnd(11) +
        "Best savings",
    ),
  );
  console.log(chalk.gray("  " + "-".repeat(nameWidth + 55)));

  for (const c of sorted) {
    const q4km = ((c.parametersBillion * 4.9) / 8 + 0.1).toFixed(1);
    const q3km = ((c.parametersBillion * 3.9) / 8 + 0.1).toFixed(1);
    const q2k = c.aggressiveSizeGb.toFixed(1);
    const bestSavings = Math.max(0, c.currentSizeGb - c.aggressiveSizeGb);
    const bestPct =
      c.currentSizeGb > 0 ? Math.round((bestSavings / c.currentSizeGb) * 100) : 0;
    const savingsStr =
      bestPct > 0 ? chalk.green(`-${bestPct}%`) : chalk.gray("no savings");

    console.log(
      "  " +
        chalk.white(c.installedName.padEnd(nameWidth)) +
        chalk.gray(`${c.currentSizeGb.toFixed(1)} GB`.padEnd(12)) +
        chalk.cyan(`${q4km} GB`.padEnd(11)) +
        chalk.cyan(`${q3km} GB`.padEnd(11)) +
        chalk.cyan(`${q2k} GB`.padEnd(11)) +
        savingsStr +
        (c.alreadyCompressed ? chalk.yellow("  (has -cx)") : ""),
    );
  }

  console.log();
  console.log(chalk.gray("  Sizes are estimates. Compression ratios vary by model architecture."));
  console.log(chalk.gray("  Run 'compressx preview <model>' for a detailed per-model breakdown."));
  console.log(chalk.gray("  Run 'compressx compress <model> -q q2_k' to actually compress.\n"));
}

/**
 * Run compressCommand for each selected model. If quant is empty,
 * compress.ts picks the hardware-recommended quant per model.
 */
async function runCompressions(selected: string[], quant: string, output?: string) {
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
        quant,
        cloud: false,
        output: output || "./compressx-output",
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
