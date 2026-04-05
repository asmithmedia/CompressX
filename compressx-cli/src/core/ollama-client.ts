import { execSync } from "child_process";

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
export function createOllamaModel(
  cxName: string,
  modelfileDir: string
): void {
  execSync(`ollama create ${cxName} -f Modelfile`, {
    cwd: modelfileDir,
    stdio: "inherit",
    timeout: 600000,
  });
}
