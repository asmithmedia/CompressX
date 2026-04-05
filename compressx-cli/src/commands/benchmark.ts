import chalk from "chalk";
import ora from "ora";
import { findLlamaCpp } from "../core/llama-cpp.js";
import { setupLlamaCpp } from "../core/setup-llama-cpp.js";
import { findLocalBlob } from "../core/ollama-blob-finder.js";
import {
  isOllamaRunning,
  listOllamaModels,
  toCxName,
} from "../core/ollama-client.js";
import {
  runLlamaBench,
  runPerplexity,
  getFileSizeGb,
  type BenchResult,
  type PerplexityResult,
} from "../core/benchmark.js";
import { runPromptBattery, type BatteryResult } from "../core/prompt-battery.js";
import {
  printBenchmarkReport,
  type BenchmarkReport,
} from "../core/benchmark-report.js";

export interface BenchmarkOptions {
  /** Compare this specific compressed model instead of auto-deriving -cx. */
  vs?: string;
  /** Skip perplexity (faster — roughly halves total runtime). */
  fast?: boolean;
  /**
   * Commander maps `--no-prompts` to `options.prompts = false` (not
   * `noPrompts`). We read both to be defensive about the convention.
   */
  prompts?: boolean;
  noPrompts?: boolean;
}

/**
 * `compressx benchmark <model>` — side-by-side comparison of an
 * original Ollama model and its compressed -cx variant.
 *
 * This is the v0.7 feature that closes the "did quantization break
 * anything?" confidence gap. It runs llama-bench for speed,
 * llama-perplexity for classical quality, and an Ollama prompt battery
 * for regression detection, then prints a color-coded verdict.
 *
 * Design decisions:
 *   - Auto-derives the -cx name if the user doesn't pass --vs so the
 *     common case is one argument.
 *   - Falls back gracefully when a measurement can't run (Ollama down,
 *     perplexity binary missing, model not installed). The final report
 *     just shows what it managed to gather.
 *   - Uses short pp/tg sequences and 1-chunk perplexity to keep total
 *     runtime under ~2 minutes on typical 4-8B models. A --fast flag
 *     skips perplexity entirely for impatient runs.
 */
export async function benchmarkCommand(
  modelId: string,
  options: BenchmarkOptions,
): Promise<void> {
  const compressedId = options.vs || toCxName(modelId);

  console.log();
  console.log(chalk.bold.cyan(`  CompressX Benchmark`));
  console.log(chalk.gray(`  ${"-".repeat(60)}`));
  console.log(`  Original:    ${chalk.white(modelId)}`);
  console.log(`  Compressed:  ${chalk.white(compressedId)}`);
  console.log();

  // Make sure both models are actually installed in Ollama, since the
  // blob lookup and prompt battery both go through there.
  const ollamaUp = await isOllamaRunning();
  if (!ollamaUp) {
    console.error(chalk.red("  Ollama is not running."));
    console.error(chalk.gray("  Start it and try again.\n"));
    process.exit(1);
  }

  const installed = await listOllamaModels();
  const origEntry = installed.find((m) => m.name === modelId);
  const cxEntry = installed.find((m) => m.name === compressedId);

  if (!origEntry) {
    console.error(chalk.red(`  Model "${modelId}" is not installed in Ollama.`));
    console.error(chalk.gray(`  Pull it first: ollama pull ${modelId}\n`));
    process.exit(1);
  }
  if (!cxEntry) {
    console.error(chalk.red(`  Compressed model "${compressedId}" is not installed in Ollama.`));
    console.error(
      chalk.gray(
        `  Compress it first: compressx compress ${modelId}\n  (or pass --vs <name> if it's installed under a different name)\n`,
      ),
    );
    process.exit(1);
  }

  // Resolve GGUF paths via the Ollama blob finder. Both models are
  // installed, so these lookups should succeed — if they don't it means
  // Ollama's on-disk layout has drifted from what we know.
  const origBlob = findLocalBlob(modelId);
  const cxBlob = findLocalBlob(compressedId);
  if (!origBlob || !cxBlob) {
    console.error(
      chalk.red(
        "  Could not locate GGUF blobs for one of the models. Is your OLLAMA_MODELS path set correctly?\n",
      ),
    );
    process.exit(1);
  }

  // Make sure llama-bench and llama-perplexity are available. These
  // come in the same release zip as llama-quantize, so findLlamaCpp
  // + setupLlamaCpp from the compress flow handle both.
  let tools = await findLlamaCpp();
  if (!tools.benchBinary || (!options.fast && !tools.perplexityBinary)) {
    const spinner = ora(
      "Benchmark tools not found — downloading llama.cpp release...",
    ).start();
    spinner.stop();
    const ok = await setupLlamaCpp();
    if (!ok) {
      console.error(chalk.red("  Could not set up llama.cpp. Benchmark aborted.\n"));
      process.exit(1);
    }
    tools = await findLlamaCpp();
  }

  // ---- Measurements ----
  let originalBench: BenchResult | null = null;
  let compressedBench: BenchResult | null = null;
  let originalPerplexity: PerplexityResult | null = null;
  let compressedPerplexity: PerplexityResult | null = null;
  let battery: BatteryResult | null = null;

  // 1. llama-bench for tokens/sec
  if (tools.benchBinary) {
    const benchSpinner = ora("Measuring speed (original)...").start();
    try {
      originalBench = runLlamaBench(tools.benchBinary, origBlob.blobPath);
      benchSpinner.text = "Measuring speed (compressed)...";
      compressedBench = runLlamaBench(tools.benchBinary, cxBlob.blobPath);
      benchSpinner.succeed(
        `Speed measured (gen: ${originalBench.generationTokensPerSec.toFixed(0)} → ${compressedBench.generationTokensPerSec.toFixed(0)} tok/s)`,
      );
    } catch (err) {
      benchSpinner.fail("llama-bench failed");
      console.error(chalk.gray(`  ${err instanceof Error ? err.message : String(err)}`));
    }
  } else {
    console.log(chalk.yellow("  Skipping speed benchmark: llama-bench not found"));
  }

  // 2. llama-perplexity for quality (unless --fast)
  if (!options.fast) {
    if (tools.perplexityBinary) {
      const pplSpinner = ora("Measuring perplexity (original)...").start();
      try {
        originalPerplexity = runPerplexity(tools.perplexityBinary, origBlob.blobPath);
        pplSpinner.text = "Measuring perplexity (compressed)...";
        compressedPerplexity = runPerplexity(tools.perplexityBinary, cxBlob.blobPath);
        if (originalPerplexity && compressedPerplexity) {
          pplSpinner.succeed(
            `Perplexity measured (${originalPerplexity.perplexity.toFixed(2)} → ${compressedPerplexity.perplexity.toFixed(2)})`,
          );
        } else {
          pplSpinner.warn("Perplexity measurement incomplete");
        }
      } catch (err) {
        pplSpinner.fail("llama-perplexity failed");
        console.error(chalk.gray(`  ${err instanceof Error ? err.message : String(err)}`));
      }
    } else {
      console.log(chalk.yellow("  Skipping perplexity: llama-perplexity not found"));
    }
  } else {
    console.log(chalk.gray("  Skipping perplexity (--fast)"));
  }

  // 3. Prompt battery via Ollama. Commander's --no-prompts convention
  // sets options.prompts = false; we also honor the legacy noPrompts.
  const skipPrompts = options.prompts === false || options.noPrompts === true;
  if (!skipPrompts) {
    const promptSpinner = ora("Running prompt battery (0/10)...").start();
    try {
      battery = await runPromptBattery(
        modelId,
        compressedId,
        undefined,
        (done, total) => {
          promptSpinner.text = `Running prompt battery (${done}/${total})...`;
        },
      );
      const divText =
        battery.diverged === 0
          ? chalk.green(`${battery.matching}/${battery.total} match`)
          : chalk.yellow(`${battery.matching}/${battery.total} match, ${battery.diverged} diverged`);
      promptSpinner.succeed(`Prompt battery: ${divText}`);
    } catch (err) {
      promptSpinner.fail("Prompt battery failed");
      console.error(chalk.gray(`  ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  // ---- Report ----
  const report: BenchmarkReport = {
    originalLabel: modelId,
    compressedLabel: compressedId,
    originalSizeGb: getFileSizeGb(origBlob.blobPath),
    compressedSizeGb: getFileSizeGb(cxBlob.blobPath),
    originalBench,
    compressedBench,
    originalPerplexity,
    compressedPerplexity,
    battery,
  };
  printBenchmarkReport(report);
}
