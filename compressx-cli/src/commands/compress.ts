import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, statSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { detectHardware } from "../core/hardware-detect.js";
import { resolveModel, recommendQuantType } from "../core/model-resolver.js";
import { findLlamaCpp } from "../core/llama-cpp.js";
import { generateModelfile } from "../core/modelfile-generator.js";
import { getDeploymentTarget, type DeploymentContext } from "../core/deployment/index.js";

interface CompressOptions {
  quant: string;
  cloud: boolean;
  output: string;
  modelfile: boolean;
  json: boolean;
  skipOllama?: boolean;
  force?: boolean;
  target?: string;
}

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
  console.log(`  HuggingFace:   ${chalk.gray(model.hfRepoId)}`);
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

  // Build deployment context early so targets can check existence
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

  // Target pre-check (e.g. is Ollama running, does LM Studio dir exist)
  const precheck = await target.preCompressionCheck();
  if (precheck.message) {
    console.log(chalk.yellow(`  Note: ${precheck.message}`));
  }

  // Check if already exists for this target (unless --force)
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
  if (!tools.convertScript || !tools.quantizeBinary) {
    toolsSpinner.fail("llama.cpp tools not found");
    console.log(chalk.yellow("\n  To install llama.cpp tools:"));
    console.log(chalk.gray("    pip install llama-cpp-python gguf"));
    console.log(chalk.gray("    # Plus download llama-quantize from:"));
    console.log(chalk.gray("    # https://github.com/ggerganov/llama.cpp/releases\n"));
    process.exit(1);
  }
  toolsSpinner.succeed("llama.cpp tools ready");

  console.log();

  // Step 1: Download
  console.log(chalk.bold("  [1/4] Downloading original weights from HuggingFace..."));
  mkdirSync(downloadDir, { recursive: true });
  try {
    execSync(
      `python -c "from huggingface_hub import snapshot_download; snapshot_download('${model.hfRepoId}', local_dir='${downloadDir.replace(/\\/g, "/")}')"`,
      { stdio: "inherit", timeout: 3600000 },
    );
  } catch {
    console.error(chalk.red("\n  Download failed. Install huggingface_hub:"));
    console.log(chalk.gray("    pip install huggingface_hub\n"));
    process.exit(1);
  }

  // Step 2: Convert to GGUF FP16
  console.log(chalk.bold("\n  [2/4] Converting to GGUF FP16..."));
  const convertSpinner = ora("Converting...").start();
  try {
    execSync(
      `python "${tools.convertScript}" "${downloadDir}" --outfile "${f16Path}" --outtype f16`,
      { stdio: "pipe", timeout: 3600000 },
    );
    convertSpinner.succeed("FP16 GGUF ready");
  } catch (err) {
    convertSpinner.fail("Conversion failed");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  // Step 3: Quantize
  console.log(chalk.bold(`\n  [3/4] Quantizing to ${quantType.toUpperCase()}...`));
  const quantSpinner = ora("Quantizing...").start();
  try {
    if (quantType === "f16") {
      execSync(`cp "${f16Path}" "${outputPath}"`, { stdio: "pipe" });
    } else {
      execSync(`"${tools.quantizeBinary}" "${f16Path}" "${outputPath}" ${quantType}`, {
        stdio: "pipe",
        timeout: 7200000,
      });
    }
    if (existsSync(f16Path) && quantType !== "f16") unlinkSync(f16Path);
    quantSpinner.succeed(`Quantized to ${quantType.toUpperCase()}`);
  } catch (err) {
    quantSpinner.fail("Quantization failed");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  // Generate Modelfile (needed for Ollama target; harmless for others)
  const modelfileContent = generateModelfile(outputFilename, model.name, quantType);
  writeFileSync(join(outputDir, "Modelfile"), modelfileContent);

  // Step 4: Deploy to target
  console.log(chalk.bold(`\n  [4/4] Deploying to ${target.name}...`));

  if (!precheck.ok) {
    // Target isn't usable right now — skip registration but keep the file.
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

  // Cleanup source files
  try {
    execSync(`rm -rf "${downloadDir}"`, { stdio: "pipe" });
  } catch {
    // ignore cleanup errors
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

  // Target-specific extra summary
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
