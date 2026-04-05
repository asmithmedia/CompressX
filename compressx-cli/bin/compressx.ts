#!/usr/bin/env node
import { program } from "commander";
import { compressCommand } from "../src/commands/compress.js";
import { modelsCommand } from "../src/commands/models.js";
import { hardwareCommand } from "../src/commands/hardware.js";
import { loginCommand } from "../src/commands/login.js";
import { scanCommand } from "../src/commands/scan.js";
import { updateCommand } from "../src/commands/update.js";
import { uninstallCommand } from "../src/commands/uninstall.js";
import { checkForUpdatesSync, printUpdateBanner } from "../src/core/update-notifier.js";

const VERSION = "0.3.0";

program
  .name("compressx")
  .description(
    "Compress LLM models for Ollama and local deployment. Originals kept, compressed versions get a -cx suffix.",
  )
  .version(VERSION);

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
  .command("update")
  .description("Update CompressX to the latest version")
  .action(updateCommand);

program
  .command("uninstall")
  .description("Uninstall CompressX and remove its data directory")
  .action(uninstallCommand);

program
  .command("login")
  .description("Authenticate with CompressX cloud (optional)")
  .action(loginCommand);

// Synchronously check the on-disk cache for update info, and fire a
// background refresh (unref'd) if the cache is stale. This never blocks
// the current command — update notifications are always "one invocation
// stale" which is fine for daily use.
const updateInfo = checkForUpdatesSync(VERSION);

program.parse();

// Print the banner AFTER commander runs so it appears at the bottom of output.
// For async commands, the banner will render right after commander's sync
// action dispatch — which is before the async work finishes. That's OK:
// it shows up at the top of the output, which is also fine.
if (updateInfo?.hasUpdate) {
  // Delay to end of current tick so any synchronous command output lands first.
  process.on("exit", () => {
    printUpdateBanner(VERSION, updateInfo.latest);
  });
}
