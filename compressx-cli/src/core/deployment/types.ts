/**
 * Deployment target abstraction.
 *
 * A deployment target decides what happens AFTER the GGUF file has been
 * produced by the shared compression pipeline (download -> FP16 GGUF ->
 * quantize). Different runtimes want different things:
 *   - Ollama: register the model via `ollama create`
 *   - LM Studio: drop the GGUF into its models directory
 *   - Raw GGUF: leave the file in the output directory for any tool
 *
 * Targets share one interface so the compress command can swap them out
 * via a single CLI flag.
 */

export type DeploymentTargetId = "ollama" | "lmstudio" | "gguf";

export interface DeploymentContext {
  /** Ollama-style model id passed on the CLI, e.g. "qwen3:4b" or a HF repo id */
  ollamaId: string;
  /** Human-readable model name, e.g. "Qwen 3 4B" */
  modelName: string;
  /** HuggingFace source repo, e.g. "Qwen/Qwen3-4B" */
  hfRepoId: string;
  /** Selected quantization type, e.g. "q4_k_m" */
  quantType: string;
  /** Directory where the compressed GGUF lives after quantization */
  outputDir: string;
  /** Filename of the compressed GGUF inside outputDir */
  outputFilename: string;
  /** Full absolute path to the compressed GGUF */
  outputPath: string;
}

export interface PreCheckResult {
  ok: boolean;
  message?: string;
}

export interface DeploymentTarget {
  readonly id: DeploymentTargetId;
  readonly name: string;

  /**
   * Called before the compression pipeline runs. Used to check whether
   * the target is usable (e.g. Ollama running) and print a helpful
   * message to the user if not.
   *
   * Returning `{ ok: false, message }` does NOT abort compression — the
   * compress command will still produce the GGUF file and print the
   * message alongside fallback instructions. This lets users with a
   * non-running Ollama still get a usable file.
   */
  preCompressionCheck(): Promise<PreCheckResult>;

  /**
   * Check whether the compressed variant already exists for this model.
   * Used to bail out early when the user runs compress twice without
   * --force. Each target defines what "exists" means.
   */
  modelExists(ctx: DeploymentContext): Promise<boolean>;

  /**
   * Do whatever the target needs to do with the freshly compressed GGUF.
   * Called after quantization completes. For Ollama this runs `ollama
   * create`. For LM Studio this copies the file. For raw GGUF this is
   * a no-op.
   */
  register(ctx: DeploymentContext): Promise<void>;

  /**
   * Return target-specific "how to run it now" instructions to print at
   * the end of a successful compression. One line, no leading spaces,
   * no chalk colors — the caller adds formatting.
   */
  getInstructions(ctx: DeploymentContext): string;

  /**
   * Optional: return a list of additional info lines to print in the
   * summary, for targets like GGUF that want to show compatible runtimes.
   */
  getExtraSummaryLines?(ctx: DeploymentContext): string[];
}
