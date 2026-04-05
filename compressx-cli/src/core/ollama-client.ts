import { spawnSync } from "node:child_process";

const OLLAMA_URL = process.env.OLLAMA_HOST || "http://localhost:11434";

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
  modified_at?: string;
}

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listOllamaModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
  const data = (await res.json()) as { models: OllamaModel[] };
  return data.models || [];
}

export async function ollamaModelExists(name: string): Promise<boolean> {
  const models = await listOllamaModels();
  return models.some((m) => m.name === name);
}

/**
 * Convert an Ollama model ID with a -cx suffix.
 * qwen3:4b → qwen3:4b-cx
 * llama3.1:8b → llama3.1:8b-cx
 * If no tag, adds :latest-cx
 */
export function toCxName(ollamaId: string): string {
  if (ollamaId.includes(":")) {
    return `${ollamaId}-cx`;
  }
  return `${ollamaId}:latest-cx`;
}

/**
 * Create an Ollama model from a GGUF file + Modelfile directory.
 * Runs `ollama create <name> -f Modelfile` in the given directory.
 */
export function createOllamaModel(cxName: string, modelfileDir: string): void {
  // Validate the name: Ollama names are letters, digits, dots, dashes,
  // underscores, colons, and slashes. Reject anything else so a
  // pathological cxName can't inject flags or shell tokens.
  if (!/^[\w.:\-/]+$/.test(cxName)) {
    throw new Error(`Invalid Ollama model name: "${cxName}"`);
  }
  const result = spawnSync("ollama", ["create", cxName, "-f", "Modelfile"], {
    cwd: modelfileDir,
    stdio: "inherit",
    timeout: 600000,
  });
  if (result.status !== 0) {
    throw new Error(`ollama create exited with code ${result.status}`);
  }
}

/**
 * Fetch model capabilities from Ollama's /api/show endpoint.
 * Ollama reports capabilities like "completion", "tools", "thinking",
 * "vision", "embedding". The "thinking" capability is what we use to
 * detect reasoning models (Qwen3, DeepSeek-R1, Phi-4-reasoning, etc.)
 * that need a higher quant floor than general chat models.
 *
 * Returns an empty array if the model isn't installed or the API fails.
 */
export async function getModelCapabilities(ollamaId: string): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: ollamaId }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { capabilities?: string[] };
    return data.capabilities || [];
  } catch {
    return [];
  }
}

/**
 * Is this a thinking/reasoning model? Reasoning models (Qwen3,
 * DeepSeek-R1, etc.) need a higher quant floor than general chat models
 * because their chain-of-thought output is fragile at low bit counts —
 * they start repeating or losing coherence at Q2_K.
 */
export async function isThinkingModel(ollamaId: string): Promise<boolean> {
  const caps = await getModelCapabilities(ollamaId);
  return caps.includes("thinking");
}
