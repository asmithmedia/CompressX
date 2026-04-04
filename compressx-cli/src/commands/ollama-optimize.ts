import chalk from "chalk";
import ora from "ora";
import { detectHardware } from "../core/hardware-detect.js";

interface OllamaModelInfo {
  name: string;
  size: number;
  details?: { quantization_level?: string; parameter_size?: string };
}

export async function ollamaOptimizeCommand() {
  console.log(chalk.bold("\n  Ollama Model Optimizer\n"));

  // Check if Ollama is running
  const spinner = ora("Connecting to Ollama...").start();
  let models: OllamaModelInfo[];

  try {
    const res = await fetch("http://localhost:11434/api/tags");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { models: OllamaModelInfo[] };
    models = data.models || [];
    spinner.succeed(`Connected to Ollama (${models.length} models installed)`);
  } catch {
    spinner.fail("Cannot connect to Ollama");
    console.log(chalk.yellow("\n  Make sure Ollama is running:"));
    console.log(chalk.gray("    ollama serve\n"));
    process.exit(1);
  }

  if (models.length === 0) {
    console.log(chalk.yellow("\n  No models installed in Ollama."));
    console.log(chalk.gray("  Pull a model first: ollama pull qwen3:4b\n"));
    return;
  }

  // Detect hardware
  const hw = await detectHardware();
  console.log(chalk.gray(`  Hardware: ${hw.gpuName || "CPU-only"} | ${hw.ramGb} GB RAM\n`));

  // Analyze models
  console.log(chalk.bold("  Installed Models:\n"));
  console.log(
    chalk.gray(
      "  " +
      "Model".padEnd(28) +
      "Current Size".padEnd(16) +
      "Quant".padEnd(12) +
      "Status"
    )
  );
  console.log(chalk.gray("  " + "-".repeat(70)));

  for (const model of models) {
    const sizeGb = (model.size / 1e9).toFixed(1);
    const quant = model.details?.quantization_level || "unknown";
    const fitsWell = model.size / 1e9 <= hw.maxModelGb;

    const status = fitsWell
      ? chalk.green("Fits your hardware")
      : chalk.yellow("Could benefit from re-quantization");

    console.log(
      `  ${chalk.white(model.name.padEnd(28))}${chalk.cyan((sizeGb + " GB").padEnd(16))}${chalk.gray(quant.padEnd(12))}${status}`
    );
  }

  console.log();
  console.log(chalk.gray("  To re-compress a model from original weights:"));
  console.log(chalk.gray("    compressx compress <model-name>\n"));
}
