import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, statSync, unlinkSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { detectHardware } from "../core/hardware-detect.js";
import { resolveModel, recommendQuantType } from "../core/model-resolver.js";
import { findLlamaCpp } from "../core/llama-cpp.js";
import { generateModelfile } from "../core/modelfile-generator.js";
import { getDeploymentTarget, type DeploymentContext } from "../core/deployment/index.js";
import { findLocalBlob } from "../core/ollama-blob-finder.js";
import { listOllamaModels } from "../core/ollama-client.js";
import { canRequantize, normalizeQuant } from "../core/quant-compat.js";

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

  // Build deployment context early
  const outputDir = resolve(options.output);
  mkdirSync(outputDir, { recursive: true });
  const modelSlug = model.ollamaId.replace(/[:/]/g, "-");
  const outputFilename = `${modelSlug}-${quantType}.gguf`;
  const outputPath = join(outputDir, outputFilename);
  const f16Path = join(outputDir, `${modelSlug}-f16.gguf`);
  const downloadDir = join(outputDir, `${modelSlug}-source`);

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

  // Find llama.cpp tools
  const toolsSpinner = ora("Checking for llama.cpp tools...").start();
  const tools = await findLlamaCpp();
  if (!tools.quantizeBinary) {
    toolsSpinner.fail("llama-quantize binary not found");
    console.log(chalk.yellow("\n  To install llama.cpp tools:"));
    console.log(chalk.gray("    Download from https://github.com/ggerganov/llama.cpp/releases"));
    console.log(chalk.gray("    Place llama-quantize in ~/.compressx/bin/ or on your PATH\n"));
    process.exit(1);
  }
  if (source.kind === "huggingface" && !tools.convertScript) {
    toolsSpinner.fail("convert_hf_to_gguf.py not found (needed for HuggingFace path)");
    console.log(chalk.yellow("\n  The HuggingFace download path needs the convert script:"));
    console.log(chalk.gray("    Download convert_hf_to_gguf.py from llama.cpp releases"));
    console.log(chalk.gray("    Place it in ~/.compressx/bin/ or on your PATH\n"));
    console.log(chalk.gray("  Or if the model is already in Ollama, skip --from-source."));
    process.exit(1);
  }
  toolsSpinner.succeed("llama.cpp tools ready");

  console.log();

  // Execute the chosen path
  if (source.kind === "local") {
    await runLocalPath(source, quantType, outputPath, tools.quantizeBinary);
  } else {
    await runHuggingFacePath(
      model.hfRepoId,
      downloadDir,
      f16Path,
      outputPath,
      quantType,
      tools.convertScript!,
      tools.quantizeBinary,
    );
  }

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

  // Cleanup source files (HuggingFace download dir only)
  if (existsSync(downloadDir)) {
    try {
      execSync(`rm -rf "${downloadDir}"`, { stdio: "pipe" });
    } catch {
      // ignore
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

  console.log();
  console.log(chalk.bold("  Run it now:"));
  console.log(chalk.cyan(`    ${target.getInstructions(ctx)}`));
  console.log();
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
  console.log(chalk.bold(`  [1/1] Re-quantizing local blob to ${targetQuant.toUpperCase()}...`));
  const quantSpinner = ora("Quantizing...").start();

  try {
    // --allow-requantize is required when the source is already quantized
    // (e.g. Q4_K_M). llama.cpp warns that this can reduce quality compared
    // to quantizing from 16/32-bit, which is exactly what we flagged in
    // the compat warning above.
    execSync(
      `"${quantizeBinary}" --allow-requantize "${source.blobPath}" "${outputPath}" ${targetQuant}`,
      {
        stdio: "pipe",
        timeout: 7200000,
      },
    );
    quantSpinner.succeed(`Re-quantized to ${targetQuant.toUpperCase()}`);
  } catch (err) {
    quantSpinner.fail("Quantization failed");
    console.error(chalk.red(String(err)));
    console.log(
      chalk.gray("\n  Try --from-source to download original weights instead.\n"),
    );
    process.exit(1);
  }
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
  try {
    execSync(
      `python -c "from huggingface_hub import snapshot_download; snapshot_download('${hfRepoId}', local_dir='${downloadDir.replace(/\\/g, "/")}')"`,
      { stdio: "inherit", timeout: 3600000 },
    );
  } catch {
    console.error(chalk.red("\n  Download failed. The huggingface_hub Python package is required:"));
    console.log(chalk.gray("    pip install huggingface_hub\n"));
    process.exit(1);
  }

  console.log(chalk.bold("\n  [2/3] Converting to GGUF FP16..."));
  const convertSpinner = ora("Converting...").start();
  try {
    execSync(`python "${convertScript}" "${downloadDir}" --outfile "${f16Path}" --outtype f16`, {
      stdio: "pipe",
      timeout: 3600000,
    });
    convertSpinner.succeed("FP16 GGUF ready");
  } catch (err) {
    convertSpinner.fail("Conversion failed");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  console.log(chalk.bold(`\n  [3/3] Quantizing to ${targetQuant.toUpperCase()}...`));
  const quantSpinner = ora("Quantizing...").start();
  try {
    if (targetQuant === "f16") {
      copyFileSync(f16Path, outputPath);
    } else {
      execSync(`"${quantizeBinary}" "${f16Path}" "${outputPath}" ${targetQuant}`, {
        stdio: "pipe",
        timeout: 7200000,
      });
    }
    if (existsSync(f16Path) && targetQuant !== "f16") unlinkSync(f16Path);
    quantSpinner.succeed(`Quantized to ${targetQuant.toUpperCase()}`);
  } catch (err) {
    quantSpinner.fail("Quantization failed");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }
}
