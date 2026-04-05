import type { DeploymentTarget, DeploymentContext, PreCheckResult } from "./types.js";
import {
  isOllamaRunning,
  ollamaModelExists,
  toCxName,
  createOllamaModel,
} from "../ollama-client.js";

/**
 * OllamaTarget wraps the existing ollama-client functions. This is a
 * pure refactor — behavior is identical to what compress.ts did inline
 * before the deployment target abstraction existed.
 */
export class OllamaTarget implements DeploymentTarget {
  readonly id = "ollama" as const;
  readonly name = "Ollama";

  async preCompressionCheck(): Promise<PreCheckResult> {
    const running = await isOllamaRunning();
    if (running) return { ok: true };
    return {
      ok: false,
      message:
        "Ollama is not running. The GGUF file will still be produced; start Ollama with `ollama serve` and run `ollama create <name>-cx -f Modelfile` to register it.",
    };
  }

  async modelExists(ctx: DeploymentContext): Promise<boolean> {
    const cxName = toCxName(ctx.ollamaId);
    return ollamaModelExists(cxName);
  }

  async register(ctx: DeploymentContext): Promise<void> {
    const cxName = toCxName(ctx.ollamaId);
    createOllamaModel(cxName, ctx.outputDir);
  }

  getInstructions(ctx: DeploymentContext): string {
    const cxName = toCxName(ctx.ollamaId);
    return `ollama run ${cxName}`;
  }
}
