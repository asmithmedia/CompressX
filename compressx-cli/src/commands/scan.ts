import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";

const Separator = inquirer.Separator;
const EXIT_VALUE = "__compressx_exit__";
import { detectHardware } from "../core/hardware-detect.js";
import {
  isOllamaRunning,
  listOllamaModels,
  toCxName,
  isThinkingModel,
} from "../core/ollama-client.js";
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
  /** Aggressive quant for the "what if" comparison. Q2_K for general
   *  chat models, Q4_0 for thinking/reasoning models which need a
   *  higher floor to stay coherent. */
  aggressiveQuant: string;
  aggressiveBpw: number;
  aggressiveSizeGb: number;
  aggressiveSavings: number;
  aggressiveSavingsPct: number;
  isThinking: boolean;
  alreadyCompressed: boolean;
  fitsWell: boolean;
}

/**
 * Bits-per-weight and quant name for the "aggressive savings" column.
 * Thinking/reasoning models (Qwen3, DeepSeek-R1, Phi-4-reasoning) lose
 * coherence at Q2_K — their chain-of-thought starts repeating and
 * never closes. Q4_0 is the safe aggressive floor for thinking models.
 * General chat models tolerate Q2_K fine.
 */
const AGGRESSIVE_QUANT_CHAT = { name: "q2_k", bpw: 3.35 };
const AGGRESSIVE_QUANT_THINKING = { name: "q4_0", bpw: 4.5 };

function getAggressiveQuant(isThinking: boolean) {
  return isThinking ? AGGRESSIVE_QUANT_THINKING : AGGRESSIVE_QUANT_CHAT;
}

function estimateSize(parametersBillion: number, bpw: number): number {
  return Math.round(((parametersBillion * 1e9 * bpw) / 8 / 1e9 + 0.1) * 100) / 100;
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
    // Skip Ollama cloud models — they're API-backed, not local files, and
    // their reported size is 0. The synthetic fallback would happily parse
    // "671b" from the tag but compressing a cloud model makes no sense.
    if (m.name.endsWith(":cloud") || m.name.includes("-cloud")) continue;
    if (m.size === 0) continue;

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

    // Detect thinking/reasoning models via Ollama's capabilities API.
    // Thinking models need a higher aggressive-quant floor (Q4_0 vs Q2_K)
    // to avoid chain-of-thought repetition and incoherence.
    const isThinking = await isThinkingModel(m.name);
    const aggressive = getAggressiveQuant(isThinking);
    const aggressiveSizeGb = estimateSize(resolved.parametersBillion, aggressive.bpw);
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
      aggressiveQuant: aggressive.name,
      aggressiveBpw: aggressive.bpw,
      aggressiveSizeGb,
      aggressiveSavings,
      aggressiveSavingsPct,
      isThinking,
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
    console.log(chalk.green("  [OK] All your models already fit your hardware well."));
    console.log();
    console.log(chalk.white(`  Here's what aggressive compression could still save:`));
    console.log();

    // Sort by biggest aggressive savings first
    const sorted = [...all].sort((a, b) => b.aggressiveSavings - a.aggressiveSavings);

    const nameWidth = Math.max(20, ...sorted.map((c) => c.installedName.length + 2));
    console.log(
      chalk.gray(
        "  " +
          "Model".padEnd(nameWidth) +
          "Current".padEnd(12) +
          "Target".padEnd(14) +
          "Savings  Type",
      ),
    );
    console.log(chalk.gray("  " + "-".repeat(nameWidth + 50)));

    for (const c of sorted) {
      const typeLabel = c.isThinking
        ? chalk.magenta("reasoning")
        : chalk.gray("chat");
      console.log(
        "  " +
          chalk.white(c.installedName.padEnd(nameWidth)) +
          chalk.gray(`${c.currentSizeGb.toFixed(1)} GB`.padEnd(12)) +
          chalk.cyan(
            `${c.aggressiveSizeGb.toFixed(1)} GB ${c.aggressiveQuant.toUpperCase()}`.padEnd(14),
          ) +
          chalk.green(`-${c.aggressiveSavingsPct}%`.padEnd(9)) +
          typeLabel +
          (c.alreadyCompressed ? chalk.yellow("  (has -cx)") : ""),
      );
    }

    console.log();
    console.log(
      chalk.gray(
        "  Quant floors: Q2_K for chat models, Q4_0 for reasoning models.",
      ),
    );
    console.log(
      chalk.gray(
        "  Reasoning models (Qwen3, DeepSeek-R1) lose chain-of-thought coherence at Q2_K.",
      ),
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
        message: `Compress any of these?`,
        choices: [
          ...selectable.map((c) => ({
            name:
              `${c.installedName.padEnd(nameWidth)} ` +
              chalk.gray(
                `${c.currentSizeGb.toFixed(1)} GB -> ${c.aggressiveSizeGb.toFixed(1)} GB ${c.aggressiveQuant.toUpperCase()}`,
              ) +
              chalk.cyan(` (-${c.aggressiveSavingsPct}%)`) +
              (c.isThinking ? chalk.magenta("  [reasoning]") : ""),
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

    // Each model gets its OWN aggressive quant — chat models go to Q2_K,
    // reasoning models go to Q4_0. This fixes the v0.5.0 bug where
    // Qwen3 and other thinking models got stuck in chain-of-thought loops
    // after being forced to Q2_K.
    const selectedWithQuants = selected
      .filter((v) => v !== EXIT_VALUE)
      .map((name) => {
        const candidate = selectable.find((c) => c.installedName === name)!;
        return { name, quant: candidate.aggressiveQuant };
      });

    await runCompressionsPerModelQuant(selectedWithQuants, options.output);
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
 * Run compressCommand for each selected model using a single shared quant.
 * Used by the normal scan flow where every candidate gets the hardware-
 * recommended quant.
 */
async function runCompressions(selected: string[], quant: string, output?: string) {
  await runCompressionsPerModelQuant(
    selected.map((name) => ({ name, quant })),
    output,
  );
}

/**
 * Run compressCommand for each selected model, using a per-model quant.
 * Used by the "aggressive savings" flow where chat models get Q2_K and
 * reasoning models get Q4_0.
 */
async function runCompressionsPerModelQuant(
  selected: Array<{ name: string; quant: string }>,
  output?: string,
) {
  console.log();
  console.log(
    chalk.bold(`  Compressing ${selected.length} model${selected.length > 1 ? "s" : ""}...`),
  );
  console.log(
    chalk.gray(`  Originals will be kept. New models will be registered as :<tag>-cx\n`),
  );

  for (let i = 0; i < selected.length; i++) {
    const { name, quant } = selected[i];
    console.log(
      chalk.bold.cyan(`\n  [${i + 1}/${selected.length}] ${name}`) +
        (quant ? chalk.gray(` -> ${quant.toUpperCase()}`) : ""),
    );
    try {
      await compressCommand(name, {
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
