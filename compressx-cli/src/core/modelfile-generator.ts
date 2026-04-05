import { execSync } from "node:child_process";

/**
 * Ask Ollama for the full Modelfile of an existing model, strip the
 * comment header and the absolute FROM path, and swap in our new GGUF
 * filename. This preserves the TEMPLATE, SYSTEM, PARAMETERs, LICENSE,
 * ADAPTER, and MESSAGES directives from the source model — everything
 * that makes Ollama actually format chat messages correctly.
 *
 * Why this matters: Qwen3, Llama 3, Gemma, etc. all have custom chat
 * templates baked into their Modelfiles (e.g. <|im_start|>user ... <|im_end|>).
 * If we write a bare Modelfile with just FROM + SYSTEM, Ollama falls
 * back to a generic template and the compressed model generates
 * garbage because it never sees the tokens it was trained on.
 *
 * Returns null if the source model isn't in Ollama (e.g. --from-source
 * path where we downloaded from HuggingFace and don't have a reference
 * Modelfile to copy from).
 */
export function getSourceModelfile(ollamaId: string): string | null {
  try {
    const output = execSync(`ollama show --modelfile ${ollamaId}`, {
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output;
  } catch {
    return null;
  }
}

/**
 * Build the Modelfile for a compressed variant. Preferred path:
 * inherit everything from the source model's Modelfile and just swap
 * the FROM line. Fallback: minimal Modelfile with generic template.
 */
export function generateModelfile(
  ggufFilename: string,
  modelName: string,
  quantType: string,
  sourceOllamaId?: string,
): string {
  // Try to inherit the source model's directives (TEMPLATE, etc.)
  if (sourceOllamaId) {
    const sourceModelfile = getSourceModelfile(sourceOllamaId);
    if (sourceModelfile) {
      // Replace the FROM line (which points at the source blob) with
      // our new relative path. `ollama create` resolves relative paths
      // against the cwd, and we run it from the output directory.
      const rewritten = sourceModelfile
        // Strip the header comments added by `ollama show`
        .replace(/^#.*\n/gm, "")
        // Replace the first FROM directive with our filename
        .replace(/^FROM\s+.*$/m, `FROM ./${ggufFilename}`);

      return `# Compressed with CompressX (${quantType.toUpperCase()})\n# Inherited from ${sourceOllamaId}\n${rewritten.trimStart()}`;
    }
  }

  // Fallback: minimal modelfile. This loses chat template fidelity but
  // is better than nothing for models not in Ollama (e.g. --from-source
  // path compressing a HuggingFace repo directly).
  return `# Modelfile for ${modelName} (${quantType.toUpperCase()})
# Compressed with CompressX (https://compressx.asmith.media)
FROM ./${ggufFilename}

# System prompt (customize as needed)
SYSTEM """You are a helpful assistant."""

# Parameters
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
`;
}
