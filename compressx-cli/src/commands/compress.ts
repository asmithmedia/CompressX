import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import chalk from "chalk";
import ora from "ora";
import { detectHardware } from "../core/hardware-detect.js";
import { resolveModel } from "../core/model-resolver.js";
import { findLlamaCpp } from "../core/llama-cpp.js";
import { generateModelfile } from "../core/modelfile-generator.js";

interface CompressOptions {
  quant: string;
  cloud: boolean;
  output: string;
  modelfile: boolean;
  json: boolean;
}

export async function compressCommand(modelId: string, options: CompressOptions) {
  // Resolve model
  const model = resolveModel(modelId);
  if (!model) {
    console.error(chalk.red(`Unknown model: ${modelId}`));
    console.log(chalk.gray("Run 'compressx models' to see available models"));
    process.exit(1);
  }

  console.log(chalk.bold(`\nCompressX - ${model.name}`));
  console.log(chalk.gray(`HuggingFace: ${model.hfRepoId}`));
  console.log(chalk.gray(`Parameters: ${model.parametersBillion}B | FP16 size: ~${model.fp16SizeGb} GB\n`));

  if (options.cloud) {
    console.log(chalk.yellow("Cloud compression is coming soon. Use local mode for now."));
    process.exit(0);
  }

  // Detect hardware
  const spinner = ora("Detecting hardware...").start();
  const hw = await detectHardware();
  spinner.succeed(
    `Hardware: ${hw.gpuName || "No GPU detected"} | RAM: ${hw.ramGb} GB | ${hw.cpuCores} cores`
  );

  if (hw.vramGb) {
    console.log(chalk.gray(`  VRAM: ${hw.vramGb} GB | Max recommended model: ~${hw.maxModelGb} GB`));
  }

  // Determine quantization type
  let quantType = options.quant;
  if (!quantType) {
    // Auto-recommend based on hardware
    const { recommendQuantType } = await import("../core/model-resolver.js");
    const recommended = recommendQuantType(model.parametersBillion, hw.maxModelGb);
    quantType = recommended.quantType;
    console.log(
      chalk.cyan(`\nAuto-selected: ${chalk.bold(quantType.toUpperCase())} (${recommended.label})`)
    );
    console.log(chalk.gray(`  Estimated size: ${recommended.estimatedSizeGb} GB`));
  }

  // Find llama.cpp binaries
  const spinner2 = ora("Checking for llama.cpp tools...").start();
  const tools = await findLlamaCpp();
  if (!tools.convertScript && !tools.quantizeBinary) {
    spinner2.fail("llama.cpp tools not found");
    console.log(chalk.yellow("\nTo install llama.cpp:"));
    console.log(chalk.gray("  pip install llama-cpp-python"));
    console.log(chalk.gray("  # or build from source: https://github.com/ggerganov/llama.cpp"));
    process.exit(1);
  }
  spinner2.succeed("llama.cpp tools found");

  // Setup output directory
  const outputDir = resolve(options.output);
  mkdirSync(outputDir, { recursive: true });

  const modelSlug = model.ollamaId.replace(/[:/]/g, "-");
  const outputFilename = `${modelSlug}-${quantType}.gguf`;
  const outputPath = join(outputDir, outputFilename);
  const f16Path = join(outputDir, `${modelSlug}-f16.gguf`);

  // Step 1: Download model
  console.log(chalk.bold("\n[1/3] Downloading model from HuggingFace..."));
  const downloadDir = join(outputDir, "source");
  mkdirSync(downloadDir, { recursive: true });

  try {
    execSync(
      `huggingface-cli download ${model.hfRepoId} --local-dir "${downloadDir}"`,
      { stdio: "inherit", timeout: 3600000 }
    );
  } catch {
    console.error(chalk.red("\nDownload failed. Make sure huggingface-cli is installed:"));
    console.log(chalk.gray("  pip install huggingface-hub"));
    process.exit(1);
  }

  // Step 2: Convert to GGUF
  console.log(chalk.bold("\n[2/3] Converting to GGUF format..."));
  const convertSpinner = ora("Converting to FP16 GGUF...").start();
  try {
    if (tools.convertScript) {
      execSync(
        `python "${tools.convertScript}" "${downloadDir}" --outfile "${f16Path}" --outtype f16`,
        { stdio: "pipe", timeout: 3600000 }
      );
    }
    convertSpinner.succeed("Converted to FP16 GGUF");
  } catch (err) {
    convertSpinner.fail("Conversion failed");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  // Step 3: Quantize
  if (quantType !== "f16") {
    console.log(chalk.bold(`\n[3/3] Quantizing to ${quantType.toUpperCase()}...`));
    const quantSpinner = ora(`Quantizing to ${quantType}...`).start();
    try {
      if (tools.quantizeBinary) {
        execSync(
          `"${tools.quantizeBinary}" "${f16Path}" "${outputPath}" ${quantType}`,
          { stdio: "pipe", timeout: 7200000 }
        );
      }
      quantSpinner.succeed(`Quantized to ${quantType.toUpperCase()}`);

      // Remove intermediate f16 file
      if (existsSync(f16Path)) {
        const { unlinkSync } = await import("fs");
        unlinkSync(f16Path);
      }
    } catch (err) {
      quantSpinner.fail("Quantization failed");
      console.error(chalk.red(String(err)));
      process.exit(1);
    }
  }

  // Generate Modelfile
  if (options.modelfile !== false) {
    const modelfileContent = generateModelfile(outputFilename, model.name, quantType);
    const modelfilePath = join(outputDir, "Modelfile");
    writeFileSync(modelfilePath, modelfileContent);
    console.log(chalk.gray(`\nGenerated Modelfile at ${modelfilePath}`));
  }

  // Summary
  const finalSize = existsSync(outputPath)
    ? (require("fs").statSync(outputPath).size / 1e9).toFixed(2)
    : "?";

  console.log(chalk.green.bold("\n--- Compression Complete! ---"));
  console.log(`Output: ${chalk.cyan(outputPath)}`);
  console.log(`Size:   ${chalk.cyan(finalSize + " GB")}`);
  console.log(`Type:   ${chalk.cyan(quantType.toUpperCase())} GGUF`);

  console.log(chalk.bold("\nDeploy to Ollama:"));
  console.log(chalk.gray(`  cd ${outputDir}`));
  console.log(chalk.gray(`  ollama create ${modelSlug}-cx -f Modelfile`));
  console.log(chalk.gray(`  ollama run ${modelSlug}-cx`));
}
