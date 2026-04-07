import { spawnSync } from "node:child_process";

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
  // Reject anything that isn't a valid Ollama model name so it can't
  // be used to pass extra flags to `ollama show`.
  if (!/^[\w.:\-/]+$/.test(ollamaId)) return null;
  try {
    const result = spawnSync("ollama", ["show", "--modelfile", ollamaId], {
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (result.status !== 0) return null;
    return result.stdout || null;
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
  numCtx?: number,
): string {
  // Try to inherit the source model's directives (TEMPLATE, etc.)
  if (sourceOllamaId) {
    const sourceModelfile = getSourceModelfile(sourceOllamaId);
    if (sourceModelfile) {
      let rewritten = sourceModelfile
        .replace(/^#.*\n/gm, "")
        .replace(/^FROM\s+.*$/m, `FROM ./${ggufFilename}`);

      // Inject or replace num_ctx if we have a VRAM-optimized value
      if (numCtx) {
        if (/^PARAMETER\s+num_ctx\s+/m.test(rewritten)) {
          rewritten = rewritten.replace(
            /^PARAMETER\s+num_ctx\s+\d+/m,
            `PARAMETER num_ctx ${numCtx}`,
          );
        } else {
          rewritten = rewritten.trimEnd() + `\nPARAMETER num_ctx ${numCtx}\n`;
        }
      }

      return `# Compressed with CompressX (${quantType.toUpperCase()})\n# Inherited from ${sourceOllamaId}\n${rewritten.trimStart()}`;
    }
  }

  const ctx = numCtx || 4096;
  return `# Modelfile for ${modelName} (${quantType.toUpperCase()})
# Compressed with CompressX (https://compressx.asmith.media)
FROM ./${ggufFilename}

# System prompt (customize as needed)
SYSTEM """You are a helpful assistant."""

# Parameters
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx ${ctx}
`;
}
