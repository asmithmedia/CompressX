import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  statSync,
  unlinkSync,
  copyFileSync,
  rmSync,
  renameSync,
} from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { detectHardware } from "../core/hardware-detect.js";
import { resolveModel, recommendQuantType } from "../core/model-resolver.js";
import { findLlamaCpp } from "../core/llama-cpp.js";
import { generateModelfile } from "../core/modelfile-generator.js";
import { getDeploymentTarget, type DeploymentContext } from "../core/deployment/index.js";
import { findLocalBlob } from "../core/ollama-blob-finder.js";
import { listOllamaModels, isThinkingModel, toCxName } from "../core/ollama-client.js";
import { canRequantize, normalizeQuant } from "../core/quant-compat.js";
import { setupLlamaCpp } from "../core/setup-llama-cpp.js";
import { runSmokeTest, printSmokeFailureHelp } from "../core/smoke-test.js";
import { runQuantizeWithProgress } from "../core/progress-quantize.js";

/**
 * Quants that are known to break thinking/reasoning models like Qwen3,
 * DeepSeek-R1, Phi-4-reasoning. Their chain-of-thought output becomes
 * incoherent or loops indefinitely at these precision levels.
 */
const UNSAFE_QUANTS_FOR_THINKING = new Set(["q2_k", "iq2_xxs", "iq2_xs", "q3_k_s"]);

interface CompressOptions {
  quant: string;
  cloud: boolean;
  output: string;
  modelfile: boolean;
  json: boolean;
  skipOllama?: boolean;
  force?: boolean;
  target?: string;
  fromSource?: boolean;
  benchmark?: boolean;
}

type CompressSource =
  | { kind: "local"; blobPath: string; sourceQuant: string; sizeBytes: number }
  | { kind: "huggingface" };

export async function compressCommand(modelId: string, options: CompressOptions) {
  const model = resolveModel(modelId);
  if (!model) {
    console.error(chalk.red(`Unknown model: ${modelId}`));
    console.log(chalk.gray("Run 'compressx models' to see supported models\n"));
    process.exit(1);
  }

  if (options.cloud) {
    console.log(chalk.yellow("Cloud compression is coming soon. Using local mode.\n"));
  }

  // Resolve deployment target (default: ollama)
  let target;
  try {
    target = getDeploymentTarget(options.target || "ollama");
  } catch (err) {
    console.error(chalk.red(`\n  ${err instanceof Error ? err.message : String(err)}\n`));
    process.exit(1);
  }

  console.log(chalk.bold.cyan(`\n  CompressX`));
  console.log(chalk.gray(`  ${"-".repeat(50)}`));
  console.log(`  Model:         ${chalk.white(model.name)}`);
  console.log(`  Source:        ${chalk.gray(model.hfRepoId)}`);
  console.log(`  Parameters:    ${chalk.gray(model.parametersBillion + "B")}`);
  console.log(`  Original size: ${chalk.gray("~" + model.fp16SizeGb + " GB (FP16)")}`);
  console.log(`  Target:        ${chalk.green(target.name)}`);
  console.log();

  // Detect hardware
  const hwSpinner = ora("Detecting hardware...").start();
  const hw = await detectHardware();
  hwSpinner.succeed(
    `${hw.gpuName || "CPU-only"} | ${hw.ramGb} GB RAM${hw.vramGb ? ` | ${hw.vramGb} GB VRAM` : ""}`,
  );

  // Determine quantization type
  let quantType = options.quant;
  if (!quantType) {
    const recommended = recommendQuantType(model.parametersBillion, hw.maxModelGb);
    quantType = recommended.quantType;
    console.log(
      chalk.cyan(`  Auto-selected: ${chalk.bold(quantType.toUpperCase())}`) +
        chalk.gray(` (${recommended.label}, ~${recommended.estimatedSizeGb} GB)`),
    );
  }

  // Thinking-model guard: warn loudly if the user asked for a quant that
  // breaks reasoning models (Qwen3, DeepSeek-R1, Phi-4-reasoning, etc.).
  // Q2_K especially causes chain-of-thought repetition and incoherent
  // output. This is a known failure mode, documented from end-to-end
  // testing on qwen3:8b where Q2_K produced stuck-thinking loops.
  if (UNSAFE_QUANTS_FOR_THINKING.has(quantType.toLowerCase())) {
    const thinking = await isThinkingModel(model.ollamaId);
    if (thinking) {
      console.log();
      console.log(
        chalk.red.bold(
          `  WARNING: ${model.name} is a reasoning model, and ${quantType.toUpperCase()} is known to break`,
        ),
      );
      console.log(
        chalk.red.bold(
          `           chain-of-thought output. The compressed model will likely loop or`,
        ),
      );
      console.log(chalk.red.bold(`           produce incoherent thinking.`));
      console.log();
      console.log(chalk.yellow(`  Recommended quants for reasoning models:`));
      console.log(chalk.cyan(`    Q4_0    — smallest safe (fastest, ~30% smaller than Q4_K_M)`));
      console.log(chalk.cyan(`    Q4_K_M  — balanced (recommended)`));
      console.log(chalk.cyan(`    Q5_K_M  — higher quality`));
      console.log();

      const { proceed } = await inquirer.prompt<{ proceed: boolean }>([
        {
          type: "confirm",
          name: "proceed",
          message: `Compress anyway with ${quantType.toUpperCase()}?`,
          default: false,
        },
      ]);

      if (!proceed) {
        console.log(chalk.gray("\n  Cancelled. Try: "));
        console.log(chalk.cyan(`    compressx compress ${modelId} -q q4_0\n`));
        process.exit(0);
      }
      console.log(chalk.yellow(`  Proceeding with ${quantType.toUpperCase()} at user request...\n`));
    }
  }

  // Build deployment context. We do all the actual work in a temp
  // workdir inside the output directory, and only promote the finished
  // GGUF file to the final path on success. If compression fails or is
  // interrupted, the cleanup in finally removes the partial state so
  // the output directory never has half-finished files.
  const outputDir = resolve(options.output);
  mkdirSync(outputDir, { recursive: true });
  const modelSlug = model.ollamaId.replace(/[:/]/g, "-");
  const outputFilename = `${modelSlug}-${quantType}.gguf`;
  const outputPath = join(outputDir, outputFilename);

  const workDir = join(outputDir, `.compressx-tmp-${modelSlug}-${Date.now()}`);
  const tmpOutputPath = join(workDir, outputFilename);
  const f16Path = join(workDir, `${modelSlug}-f16.gguf`);
  const downloadDir = join(workDir, "source");
  mkdirSync(workDir, { recursive: true });

  // The ctx passed to deployment targets uses the FINAL paths, since
  // those are what the user sees and what the targets need for
  // registration. The pipeline works in workDir, then we atomically
  // rename the finished GGUF into place before calling target.register().
  const ctx: DeploymentContext = {
    ollamaId: model.ollamaId,
    modelName: model.name,
    hfRepoId: model.hfRepoId,
    quantType,
    outputDir,
    outputFilename,
    outputPath,
  };

  // Decide source path: local blob vs HuggingFace download
  const source = await chooseSource(model.ollamaId, quantType, options.fromSource === true);

  if (source.kind === "local") {
    console.log(
      chalk.green(
        `  Source path:   local Ollama blob (${source.sourceQuant.toUpperCase()}, ${(source.sizeBytes / 1e9).toFixed(1)} GB)`,
      ),
    );
  } else {
    console.log(
      chalk.yellow(
        `  Source path:   ${options.fromSource ? "HuggingFace download (--from-source)" : "HuggingFace download (fallback)"}`,
      ),
    );
  }
  console.log();

  // Target pre-check
  const precheck = await target.preCompressionCheck();
  if (precheck.message) {
    console.log(chalk.yellow(`  Note: ${precheck.message}`));
  }

  // Check if the target variant already exists (unless --force)
  if (!options.force) {
    const exists = await target.modelExists(ctx);
    if (exists) {
      console.log(chalk.yellow(`\n  This model is already deployed to ${target.name}.`));
      console.log(chalk.gray(`  Use --force to recompress and overwrite.\n`));
      process.exit(0);
    }
  }

  // Find llama.cpp tools — auto-download on first run if missing
  const toolsSpinner = ora("Checking for llama.cpp tools...").start();
  let tools = await findLlamaCpp();
  const needsQuantize = !tools.quantizeBinary;
  const needsConvert = source.kind === "huggingface" && !tools.convertScript;

  if (needsQuantize || needsConvert) {
    toolsSpinner.warn("llama.cpp tools not found — downloading now (one-time setup)");
    console.log();
    const success = await setupLlamaCpp();
    if (!success) {
      console.error(chalk.red("\n  Setup failed. You can install llama.cpp manually:"));
      console.error(chalk.gray("    https://github.com/ggerganov/llama.cpp/releases"));
      console.error(chalk.gray("    Unpack into ~/.compressx/bin/llama-bin/\n"));
      process.exit(1);
    }
    // Re-check after setup
    tools = await findLlamaCpp();
    if (!tools.quantizeBinary) {
      console.error(
        chalk.red("\n  llama-quantize still not found after setup. Please report this issue.\n"),
      );
      process.exit(1);
    }
    if (source.kind === "huggingface" && !tools.convertScript) {
      console.error(
        chalk.red(
          "\n  convert_hf_to_gguf.py still not found. Try --from-source later or report this.\n",
        ),
      );
      process.exit(1);
    }
  } else {
    toolsSpinner.succeed("llama.cpp tools ready");
  }

  console.log();

  // Everything past this point runs inside a try/finally so a crash,
  // OOM, timeout, or ^C leaves no partial files behind.
  let pipelineSucceeded = false;
  try {
    // Execute the chosen path — writes to tmpOutputPath inside workDir
    if (source.kind === "local") {
      await runLocalPath(source, quantType, tmpOutputPath, tools.quantizeBinary);
    } else {
      await runHuggingFacePath(
        model.hfRepoId,
        downloadDir,
        f16Path,
        tmpOutputPath,
        quantType,
        tools.convertScript!,
        tools.quantizeBinary,
      );
    }

    // Atomically promote the finished file to its final location.
    // renameSync is atomic within the same filesystem, which workDir
    // always is (it's a subdir of outputDir).
    if (existsSync(outputPath)) {
      unlinkSync(outputPath);
    }
    renameSync(tmpOutputPath, outputPath);

    // Generate Modelfile. When the source model exists in Ollama, we
    // inherit its TEMPLATE/SYSTEM/PARAMETER directives so the compressed
    // variant keeps the correct chat format (Qwen3, Llama 3, Gemma, etc.
    // all have custom templates that matter). Otherwise fall back to a
    // minimal generic Modelfile.
    const modelfileContent = generateModelfile(
      outputFilename,
      model.name,
      quantType,
      source.kind === "local" ? model.ollamaId : undefined,
    );
    writeFileSync(join(outputDir, "Modelfile"), modelfileContent);

    // Step 4: Deploy to target
    console.log(chalk.bold(`\n  Deploying to ${target.name}...`));
    if (!precheck.ok) {
      console.log(chalk.yellow(`  Skipped: ${precheck.message || "target not available"}`));
    } else {
      const deploySpinner = ora(`Installing for ${target.name}...`).start();
      try {
        await target.register(ctx);
        deploySpinner.succeed(`Deployed to ${chalk.green(target.name)}`);
      } catch (err) {
        deploySpinner.fail(`${target.name} deployment failed`);
        console.log(chalk.gray(`  ${err instanceof Error ? err.message : String(err)}`));
      }
    }

    pipelineSucceeded = true;
  } finally {
    // Always clean up the temp workdir, success or failure. If the
    // pipeline failed, this also removes any partially-written GGUF
    // files so the output directory stays clean.
    if (existsSync(workDir)) {
      try {
        rmSync(workDir, { recursive: true, force: true });
      } catch {
        // ignore — worst case we leave a tmp dir behind, not fatal
      }
    }
    if (!pipelineSucceeded) {
      console.log(chalk.gray("\n  Cleaned up partial files from failed compression.\n"));
    }
  }

  // Summary
  const finalSize = existsSync(outputPath) ? statSync(outputPath).size / 1e9 : 0;
  const reduction = Math.round(((model.fp16SizeGb - finalSize) / model.fp16SizeGb) * 100);

  console.log(chalk.green.bold("\n  [OK] Compression complete!"));
  console.log(chalk.gray(`  ${"-".repeat(50)}`));
  console.log(`  ${chalk.gray("Original:")}    ${model.fp16SizeGb} GB`);
  console.log(
    `  ${chalk.gray("Compressed:")}  ${chalk.green(finalSize.toFixed(2) + " GB")} ${chalk.gray(`(-${reduction}%)`)}`,
  );
  console.log(`  ${chalk.gray("Quant:")}       ${quantType.toUpperCase()}`);
  console.log(`  ${chalk.gray("Target:")}      ${chalk.cyan(target.name)}`);
  console.log(
    `  ${chalk.gray("Method:")}      ${source.kind === "local" ? "local re-quantization" : "fresh download + quantization"}`,
  );

  const extraLines = target.getExtraSummaryLines?.(ctx) || [];
  if (extraLines.length > 0) {
    console.log();
    for (const line of extraLines) {
      console.log(`  ${chalk.gray(line)}`);
    }
  }

  // Post-compression smoke test — only for Ollama target, since that's
  // the only one we can run inference against without help from the user.
  // The test catches broken templates (v0.5.0 bug), over-quantization
  // repetition (qwen3:8b @ Q2_K bug), and tokenizer mismatches BEFORE
  // the user discovers them in production.
  if (target.id === "ollama" && precheck.ok) {
    console.log();
    const cxName = toCxName(model.ollamaId);
    const smokeResult = await runSmokeTest(cxName);
    if (!smokeResult.ok) {
      printSmokeFailureHelp(cxName, model.ollamaId, quantType, smokeResult);
    }
  }

  console.log();
  console.log(chalk.bold("  Run it now:"));
  console.log(chalk.cyan(`    ${target.getInstructions(ctx)}`));
  console.log();

  // Opt-in benchmark: compare the freshly-compressed variant against
  // the original side-by-side. Only works for the Ollama target since
  // the prompt battery needs both models registered there, and we
  // rely on Ollama's blob layout to locate the original GGUF.
  if (options.benchmark && target.id === "ollama" && precheck.ok) {
    const { benchmarkCommand } = await import("./benchmark.js");
    await benchmarkCommand(model.ollamaId, { fast: false });
  } else if (options.benchmark && target.id !== "ollama") {
    console.log(
      chalk.gray(
        "  Note: --benchmark is only supported with --target ollama (skipped).\n",
      ),
    );
  }
}

/**
 * Decide whether to use the local Ollama blob or download from HuggingFace.
 *
 * Rules:
 *   1. --from-source forces HuggingFace regardless of local state
 *   2. If the model isn't installed locally -> HuggingFace
 *   3. If target quant is equal/higher precision than source -> HuggingFace
 *      (can't upgrade quality from a quantized file)
 *   4. Otherwise -> local blob, with warnings for aggressive jumps
 */
async function chooseSource(
  ollamaId: string,
  targetQuant: string,
  forceFromSource: boolean,
): Promise<CompressSource> {
  if (forceFromSource) return { kind: "huggingface" };

  const blob = findLocalBlob(ollamaId);
  if (!blob) return { kind: "huggingface" };

  // Find the current quant level from Ollama's API
  let sourceQuantRaw: string | null = null;
  try {
    const installed = await listOllamaModels();
    const match = installed.find((m) => m.name === ollamaId);
    sourceQuantRaw = match?.details?.quantization_level || null;
  } catch {
    // Ollama not running or API failed — we have the file but don't know the quant.
    // Fall back to HuggingFace to be safe.
    return { kind: "huggingface" };
  }

  const sourceQuant = normalizeQuant(sourceQuantRaw);
  if (!sourceQuant) {
    console.log(
      chalk.gray(
        `  Local blob found but current quant (${sourceQuantRaw}) is unrecognized; downloading from source.`,
      ),
    );
    return { kind: "huggingface" };
  }

  const decision = canRequantize(sourceQuant, targetQuant);

  if (decision.kind === "impossible") {
    console.log(
      chalk.yellow(
        `  Local re-quantization not possible: ${decision.reason}. Falling back to HuggingFace download.`,
      ),
    );
    return { kind: "huggingface" };
  }

  if (decision.kind === "warn") {
    console.log(chalk.yellow(`  ${decision.message}`));
  } else if (decision.kind === "strong-warn") {
    console.log(chalk.red.bold(`  WARNING: ${decision.message}`));
  }

  return {
    kind: "local",
    blobPath: blob.blobPath,
    sourceQuant,
    sizeBytes: blob.sizeBytes,
  };
}

/**
 * Local re-quantization path: copy the existing Ollama blob into our
 * output directory (so llama-quantize has a proper extension to work
 * with) then re-quantize in place.
 *
 * Much faster than the HuggingFace path: skip download, skip FP16
 * conversion, just run llama-quantize once.
 */
async function runLocalPath(
  source: Extract<CompressSource, { kind: "local" }>,
  targetQuant: string,
  outputPath: string,
  quantizeBinary: string,
) {
  console.log(
    chalk.bold(`  [1/1] Re-quantizing local blob to ${targetQuant.toUpperCase()}...`),
  );

  // --allow-requantize is required when the source is already quantized
  // (e.g. Q4_K_M). llama.cpp warns that this can reduce quality compared
  // to quantizing from 16/32-bit, which is exactly what we flagged in
  // the compat warning above.
  //
  // runQuantizeWithProgress streams stderr and renders a live bar driven
  // by the per-tensor "[N/M]" lines llama-quantize emits. The argument
  // list is passed as an array so it's injection-safe by construction.
  const result = await runQuantizeWithProgress({
    binary: quantizeBinary,
    args: ["--allow-requantize", source.blobPath, outputPath, targetQuant],
    timeoutMs: 7200000,
  });

  if (result.status !== 0) {
    console.error(chalk.red("\n  Quantization failed:"));
    console.error(chalk.red(result.stderr || "unknown error"));
    console.log(
      chalk.gray("\n  Try --from-source to download original weights instead.\n"),
    );
    process.exit(1);
  }

  console.log(chalk.green(`  [OK] Re-quantized to ${targetQuant.toUpperCase()}`));
}

/**
 * HuggingFace path: download original weights, convert to FP16 GGUF,
 * quantize to target. Produces the cleanest possible output but
 * requires 5-30x the time of the local path.
 */
async function runHuggingFacePath(
  hfRepoId: string,
  downloadDir: string,
  f16Path: string,
  outputPath: string,
  targetQuant: string,
  convertScript: string,
  quantizeBinary: string,
) {
  console.log(chalk.bold("  [1/3] Downloading original weights..."));
  mkdirSync(downloadDir, { recursive: true });

  // Using a Python one-liner is still the simplest way to invoke
  // huggingface_hub's snapshot_download. We pass the script body as a
  // single argument via `-c`, so hfRepoId and downloadDir are inside a
  // Python string literal — not a shell-interpolated string. This is
  // safe from shell injection but would be vulnerable to Python string
  // injection if hfRepoId contained single quotes. Validate input here:
  if (!/^[\w./\-]+$/.test(hfRepoId)) {
    console.error(chalk.red(`\n  Invalid repository id: "${hfRepoId}"`));
    process.exit(1);
  }
  const pyScript = `from huggingface_hub import snapshot_download; snapshot_download('${hfRepoId}', local_dir=r'${downloadDir}')`;
  const dlResult = spawnSync("python", ["-c", pyScript], {
    stdio: "inherit",
    timeout: 3600000,
  });
  if (dlResult.status !== 0) {
    console.error(chalk.red("\n  Download failed. The huggingface_hub Python package is required:"));
    console.log(chalk.gray("    pip install huggingface_hub\n"));
    process.exit(1);
  }

  console.log(chalk.bold("\n  [2/3] Converting to GGUF FP16..."));
  const convertSpinner = ora("Converting...").start();
  const convertResult = spawnSync(
    "python",
    [convertScript, downloadDir, "--outfile", f16Path, "--outtype", "f16"],
    { stdio: "pipe", timeout: 3600000 },
  );
  if (convertResult.status !== 0) {
    convertSpinner.fail("Conversion failed");
    console.error(chalk.red(convertResult.stderr?.toString() || "unknown error"));
    process.exit(1);
  }
  convertSpinner.succeed("FP16 GGUF ready");

  console.log(chalk.bold(`\n  [3/3] Quantizing to ${targetQuant.toUpperCase()}...`));

  if (targetQuant === "f16") {
    copyFileSync(f16Path, outputPath);
    console.log(chalk.green(`  [OK] Copied FP16 GGUF (no quantization needed)`));
  } else {
    const quantResult = await runQuantizeWithProgress({
      binary: quantizeBinary,
      args: [f16Path, outputPath, targetQuant],
      timeoutMs: 7200000,
    });
    if (quantResult.status !== 0) {
      console.error(chalk.red("\n  Quantization failed:"));
      console.error(chalk.red(quantResult.stderr || "unknown error"));
      process.exit(1);
    }
    console.log(chalk.green(`  [OK] Quantized to ${targetQuant.toUpperCase()}`));
  }

  if (existsSync(f16Path) && targetQuant !== "f16") unlinkSync(f16Path);
}
