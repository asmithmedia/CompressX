#!/usr/bin/env node
import { program } from "commander";
import { compressCommand } from "../src/commands/compress.js";
import { modelsCommand } from "../src/commands/models.js";
import { hardwareCommand } from "../src/commands/hardware.js";
import { loginCommand } from "../src/commands/login.js";
import { scanCommand } from "../src/commands/scan.js";

program
  .name("compressx")
  .description("Compress LLM models for Ollama and local deployment. Originals kept, compressed versions get a -cx suffix.")
  .version("0.2.0");

// Default: scan Ollama library and suggest compressions
program
  .command("scan", { isDefault: true })
  .description("Scan your Ollama library and suggest compressions (default)")
  .option("--all", "Include already-compressed models")
  .option("-o, --output <dir>", "Output directory for GGUF files", "./compressx-output")
  .action(scanCommand);

program
  .command("compress <model>")
  .description("Compress a specific model (e.g., qwen3:4b)")
  .option("-q, --quant <type>", "Quantization type (q8_0, q5_k_m, q4_k_m, q3_k_m, q2_k)", "")
  .option("--cloud", "Use cloud compression (coming soon)")
  .option("-o, --output <dir>", "Output directory", "./compressx-output")
  .option("--no-modelfile", "Skip Modelfile generation")
  .option("--skip-ollama", "Don't auto-register in Ollama")
  .option("--force", "Recompress even if -cx variant exists")
  .option("--json", "Output as JSON")
  .action(compressCommand);

program
  .command("models [query]")
  .description("List supported models")
  .option("-f, --family <name>", "Filter by family (Qwen, Gemma, Llama, etc.)")
  .option("--featured", "Show featured models only")
  .action(modelsCommand);

program
  .command("hardware")
  .description("Show detected hardware capabilities")
  .action(hardwareCommand);

program
  .command("login")
  .description("Authenticate with CompressX cloud (optional)")
  .action(loginCommand);

program.parse();
