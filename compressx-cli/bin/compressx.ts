#!/usr/bin/env node
import { program } from "commander";
import { compressCommand } from "../src/commands/compress.js";
import { modelsCommand } from "../src/commands/models.js";
import { hardwareCommand } from "../src/commands/hardware.js";
import { loginCommand } from "../src/commands/login.js";
import { ollamaOptimizeCommand } from "../src/commands/ollama-optimize.js";

program
  .name("compressx")
  .description("Compress LLM models for local deployment")
  .version("0.1.0");

program
  .command("compress <model>")
  .description("Compress a model to GGUF format")
  .option("-q, --quant <type>", "Quantization type (q8_0, q5_k_m, q4_k_m, q3_k_m, q2_k)", "")
  .option("--cloud", "Use cloud compression (requires login, costs credits)")
  .option("-o, --output <dir>", "Output directory", "./compressx-output")
  .option("--no-modelfile", "Skip Modelfile generation")
  .option("--json", "Output as JSON")
  .action(compressCommand);

program
  .command("models [query]")
  .description("Search available models")
  .option("-f, --family <name>", "Filter by family (Qwen, Gemma, Llama, etc.)")
  .option("--featured", "Show featured models only")
  .action(modelsCommand);

program
  .command("hardware")
  .description("Detect and display local hardware capabilities")
  .action(hardwareCommand);

program
  .command("login")
  .description("Authenticate with CompressX for cloud features")
  .action(loginCommand);

program
  .command("ollama-optimize")
  .description("Scan and re-optimize installed Ollama models for your hardware")
  .action(ollamaOptimizeCommand);

program.parse();
