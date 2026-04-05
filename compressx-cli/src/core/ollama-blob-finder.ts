import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

/**
 * Ollama stores models in an OCI-style layout:
 *
 *   ~/.ollama/models/
 *     manifests/
 *       registry.ollama.ai/library/<model>/<tag>           (JSON manifest)
 *       <other-registries>/<namespace>/<model>/<tag>
 *     blobs/
 *       sha256-<digest>                                      (raw files)
 *
 * The manifest contains a `layers` array. The layer with
 * `mediaType: application/vnd.ollama.image.model` is the GGUF file.
 * Its `digest` field points to `blobs/sha256-<digest-without-prefix>`.
 *
 * This module parses the manifest and returns the absolute path to the
 * GGUF blob on disk, so the hybrid compress path can re-quantize it
 * without re-downloading from HuggingFace.
 */

interface OllamaManifestLayer {
  mediaType: string;
  digest: string;
  size?: number;
}

interface OllamaManifest {
  schemaVersion: number;
  layers: OllamaManifestLayer[];
}

export interface LocalBlobInfo {
  /** Absolute path to the GGUF file on disk */
  blobPath: string;
  /** Size of the blob in bytes */
  sizeBytes: number;
  /** The resolved manifest path (useful for debugging) */
  manifestPath: string;
}

const GGUF_MEDIA_TYPE = "application/vnd.ollama.image.model";

function getOllamaModelsDir(): string {
  // Allow override via env var (matches Ollama's own convention)
  if (process.env.OLLAMA_MODELS) return process.env.OLLAMA_MODELS;
  if (platform() === "win32") {
    return join(homedir(), ".ollama", "models");
  }
  return join(homedir(), ".ollama", "models");
}

/**
 * Parse an Ollama model name into (registry, namespace, model, tag).
 *
 * Examples:
 *   qwen3:4b                    -> registry.ollama.ai / library / qwen3 / 4b
 *   library/qwen3:4b            -> registry.ollama.ai / library / qwen3 / 4b
 *   registry.ollama.ai/library/qwen3:4b -> registry.ollama.ai / library / qwen3 / 4b
 *   hf.co/someone/model:tag     -> hf.co / someone / model / tag
 */
function parseModelName(name: string): {
  registry: string;
  namespace: string;
  model: string;
  tag: string;
} {
  const [nameWithoutTag, tag = "latest"] = name.split(":");
  const parts = nameWithoutTag.split("/");

  if (parts.length === 1) {
    // bare model name like "qwen3"
    return {
      registry: "registry.ollama.ai",
      namespace: "library",
      model: parts[0],
      tag,
    };
  }
  if (parts.length === 2) {
    // "library/qwen3" or similar
    return {
      registry: "registry.ollama.ai",
      namespace: parts[0],
      model: parts[1],
      tag,
    };
  }
  // 3+ parts: full path like "registry.ollama.ai/library/qwen3"
  return {
    registry: parts[0],
    namespace: parts[1],
    model: parts.slice(2).join("/"),
    tag,
  };
}

/**
 * Try to find the local GGUF blob for an Ollama model.
 * Returns null if the model isn't installed, the manifest is missing,
 * or the GGUF layer can't be located.
 *
 * Never throws — all errors result in null so the caller can fall back
 * to the HuggingFace download path.
 */
export function findLocalBlob(ollamaModelName: string): LocalBlobInfo | null {
  try {
    const modelsDir = getOllamaModelsDir();
    if (!existsSync(modelsDir)) return null;

    const { registry, namespace, model, tag } = parseModelName(ollamaModelName);
    const manifestPath = join(modelsDir, "manifests", registry, namespace, model, tag);

    if (!existsSync(manifestPath)) return null;

    const raw = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as OllamaManifest;

    const ggufLayer = manifest.layers?.find((l) => l.mediaType === GGUF_MEDIA_TYPE);
    if (!ggufLayer) return null;

    const digest = ggufLayer.digest.replace(/^sha256:/, "");
    const blobPath = join(modelsDir, "blobs", `sha256-${digest}`);

    if (!existsSync(blobPath)) return null;

    const sizeBytes = statSync(blobPath).size;

    return { blobPath, sizeBytes, manifestPath };
  } catch {
    return null;
  }
}

/**
 * Best-effort attempt to find the "base" model's blob for a given name.
 * If the user asks about "qwen3" but they have "qwen3:4b" installed, we
 * return the latter. Used as a fallback when exact match fails.
 */
export function findLocalBlobFuzzy(ollamaModelName: string): LocalBlobInfo | null {
  const exact = findLocalBlob(ollamaModelName);
  if (exact) return exact;

  // If the name had no tag, try common tag fallbacks
  if (!ollamaModelName.includes(":")) {
    for (const tag of ["latest", "default"]) {
      const hit = findLocalBlob(`${ollamaModelName}:${tag}`);
      if (hit) return hit;
    }
  }

  return null;
}

/**
 * Scan the full manifest tree and return every installed model name.
 * Used for debugging and for the hardware / scan commands.
 */
export function listInstalledModelNames(): string[] {
  try {
    const modelsDir = getOllamaModelsDir();
    const manifestsRoot = join(modelsDir, "manifests");
    if (!existsSync(manifestsRoot)) return [];

    const names: string[] = [];
    const walk = (dir: string, depth: number, parts: string[]) => {
      if (depth > 5) return; // safety
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full, depth + 1, [...parts, entry]);
        } else if (stat.isFile()) {
          // File name is the tag, parent dir is the model
          if (parts.length >= 2) {
            const model = parts.slice(1).join("/");
            names.push(`${model}:${entry}`);
          }
        }
      }
    };

    walk(manifestsRoot, 0, []);
    return names;
  } catch {
    return [];
  }
}
