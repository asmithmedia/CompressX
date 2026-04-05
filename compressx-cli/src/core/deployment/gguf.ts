import { existsSync } from "node:fs";
import type { DeploymentTarget, DeploymentContext, PreCheckResult } from "./types.js";

/**
 * GGUFTarget is the "bring your own runtime" target. It does not
 * register the compressed model with any service — the file is already
 * in the --output directory by the time register() is called, and this
 * target just prints helpful next steps for users who run llama.cpp
 * directly, Jan, GPT4All, Msty, text-generation-webui, koboldcpp, or
 * any other GGUF-compatible tool.
 */
export class GGUFTarget implements DeploymentTarget {
  readonly id = "gguf" as const;
  readonly name = "GGUF file";

  async preCompressionCheck(): Promise<PreCheckResult> {
    return { ok: true };
  }

  async modelExists(ctx: DeploymentContext): Promise<boolean> {
    // Only "exists" if the exact output file is already there from a
    // previous run. Useful for --force detection.
    return existsSync(ctx.outputPath);
  }

  async register(_ctx: DeploymentContext): Promise<void> {
    // No-op. The quantize step already wrote the file to outputPath.
  }

  getInstructions(ctx: DeploymentContext): string {
    return `File ready: ${ctx.outputPath}`;
  }

  getExtraSummaryLines(_ctx: DeploymentContext): string[] {
    return [
      "Compatible with:",
      "  llama.cpp           ./llama-cli -m <file>",
      "  Jan                 drop into ~/jan/models/",
      "  GPT4All             drop into ~/.local/share/nomic.ai/GPT4All/",
      "  Msty                Add Local Model in Settings",
      "  text-generation-webui  drop into models/",
      "  koboldcpp           ./koboldcpp <file>",
    ];
  }
}
