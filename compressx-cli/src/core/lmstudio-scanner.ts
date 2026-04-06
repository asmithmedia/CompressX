import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename, extname } from "node:path";
import { normalizeQuant } from "./quant-compat.js";

/**
 * LM Studio model scanner — discovers GGUF files in LM Studio's local
 * models directory and returns structured metadata so they can be used
 * as compression sources.
 *
 * LM Studio's model directory layout:
 *   ~/.lmstudio/models/
 *     <Publisher>/
 *       <Repo>/
 *         <file>.gguf
 *
 * Example:
 *   ~/.lmstudio/models/Qwen/Qwen3-4B/qwen3-4b-q4_k_m.gguf
 *
 * This mirrors HuggingFace's <org>/<repo> structure. The GGUF files are
 * plain files — no manifests, no digests, no layers. Much simpler than
 * Ollama's OCI layout.
 */

export interface LMStudioModel {
  /** Full relative path from models dir: "Qwen/Qwen3-4B/qwen3-4b-q4_k_m.gguf" */
  name: string;
  /** Human-friendly: "Qwen3-4B (Q4_K_M)" */
  displayName: string;
  /** Absolute path to the GGUF file */
  ggufPath: string;
  /** Size on disk in bytes */
  sizeBytes: number;
  /** Size on disk in GB */
  sizeGb: number;
  /** Quant level inferred from filename, or null if unrecognizable */
  inferredQuant: string | null;
  /** Publisher from directory structure (e.g. "Qwen") */
  publisher: string;
  /** Repo from directory structure (e.g. "Qwen3-4B") */
  repo: string;
}

/**
 * Get the path to LM Studio's models directory. Cross-platform:
 *   macOS / Linux:  ~/.lmstudio/models/
 *   Windows:        %USERPROFILE%\.lmstudio\models\
 *
 * Can be overridden with the LM_STUDIO_MODELS env var for testing.
 */
export function getLMStudioModelsDir(): string {
  if (process.env.LM_STUDIO_MODELS) return process.env.LM_STUDIO_MODELS;
  return join(homedir(), ".lmstudio", "models");
}

/**
 * Infer the quantization level from a GGUF filename.
 *
 * Common conventions from HuggingFace community uploads:
 *   model-q4_k_m.gguf  → q4_k_m
 *   model-Q8_0.gguf    → q8_0
 *   model.q5_k_m.gguf  → q5_k_m
 *   model-f16.gguf     → f16
 *   model-IQ2_XXS.gguf → iq2_xxs
 *   model.gguf         → null (unknown)
 *
 * Returns the normalized quant string (lowercase, validated against
 * BITS_PER_WEIGHT) or null if unrecognizable.
 */
export function inferQuantFromFilename(filename: string): string | null {
  // Strip the .gguf extension, then try to match a quant identifier at the
  // end of the name. Quant names can contain underscores (q4_k_m, iq2_xxs),
  // so we can't use a simple "last token after separator" approach. Instead
  // we enumerate the known quant patterns as alternatives and match the
  // longest one anchored to the end.
  const withoutExt = filename.replace(/\.gguf$/i, "");

  // Try known multi-part quant formats first (longest match wins), then
  // fall back to shorter patterns. All must be preceded by a separator.
  const patterns = [
    // Multi-part K-quant variants: q4_k_m, q5_k_s, q3_k_l, etc.
    /[-._]((?:i?q\d_k_[a-z]))\s*$/i,
    // IQ quants: iq2_xxs, iq2_xs
    /[-._](iq\d_[a-z]+)\s*$/i,
    // Simple quants: q8_0, q4_0, q5_0, q6_k
    /[-._](q\d_[a-z0-9]+)\s*$/i,
    // Floating point: f16, f32, bf16
    /[-._]((?:b?f(?:16|32)))\s*$/i,
  ];

  for (const pattern of patterns) {
    const match = withoutExt.match(pattern);
    if (match) {
      const normalized = normalizeQuant(match[1]);
      if (normalized) return normalized;
    }
  }

  return null;
}

/**
 * Build a display name from the directory structure + filename.
 *   publisher="Qwen", repo="Qwen3-4B", quant="q4_k_m"
 *   → "Qwen3-4B (Q4_K_M)"
 */
function buildDisplayName(repo: string, quant: string | null): string {
  if (quant) return `${repo} (${quant.toUpperCase()})`;
  return repo;
}

/**
 * Scan LM Studio's models directory for GGUF files. Returns an array
 * of structured entries sorted by publisher then size (largest first).
 *
 * Walks up to 3 levels deep to handle both the standard
 * <Publisher>/<Repo>/<file>.gguf layout and files placed directly in
 * a publisher or repo directory.
 *
 * Never throws — returns an empty array if the directory doesn't exist
 * or is unreadable.
 */
export function scanLMStudioModels(): LMStudioModel[] {
  const modelsDir = getLMStudioModelsDir();
  if (!existsSync(modelsDir)) return [];

  const results: LMStudioModel[] = [];

  try {
    // Level 1: publishers
    const publishers = safeReaddir(modelsDir);
    for (const pub of publishers) {
      const pubPath = join(modelsDir, pub);
      if (!isDirectory(pubPath)) continue;

      // Level 2: repos
      const repos = safeReaddir(pubPath);
      for (const repo of repos) {
        const repoPath = join(pubPath, repo);

        if (isDirectory(repoPath)) {
          // Level 3: GGUF files inside repo dir
          const files = safeReaddir(repoPath);
          for (const file of files) {
            if (!file.toLowerCase().endsWith(".gguf")) continue;
            const filePath = join(repoPath, file);
            if (!isFile(filePath)) continue;
            const size = statSync(filePath).size;
            const quant = inferQuantFromFilename(file);
            results.push({
              name: `${pub}/${repo}/${file}`,
              displayName: buildDisplayName(repo, quant),
              ggufPath: filePath,
              sizeBytes: size,
              sizeGb: Math.round((size / 1e9) * 100) / 100,
              inferredQuant: quant,
              publisher: pub,
              repo,
            });
          }
        } else if (repo.toLowerCase().endsWith(".gguf") && isFile(repoPath)) {
          // GGUF directly inside publisher dir (unusual but possible)
          const size = statSync(repoPath).size;
          const quant = inferQuantFromFilename(repo);
          results.push({
            name: `${pub}/${repo}`,
            displayName: buildDisplayName(pub, quant),
            ggufPath: repoPath,
            sizeBytes: size,
            sizeGb: Math.round((size / 1e9) * 100) / 100,
            inferredQuant: quant,
            publisher: pub,
            repo: pub,
          });
        }
      }
    }
  } catch {
    // Permission errors, symlink cycles, etc. — return what we found.
  }

  // Sort: by publisher, then by size descending
  results.sort((a, b) => {
    if (a.publisher !== b.publisher) return a.publisher.localeCompare(b.publisher);
    return b.sizeBytes - a.sizeBytes;
  });

  return results;
}

/**
 * Find a specific model in LM Studio's directory by name. Supports
 * matching by:
 *   - Full path: "Qwen/Qwen3-4B/qwen3-4b-q4_k_m.gguf"
 *   - Publisher/Repo: "Qwen/Qwen3-4B" (picks the first/largest GGUF)
 *   - Repo only: "Qwen3-4B" (picks the first match)
 *
 * Returns the matching model or null.
 */
export function findLMStudioModel(query: string): LMStudioModel | null {
  const models = scanLMStudioModels();
  if (models.length === 0) return null;

  const lower = query.toLowerCase();

  // Exact full path match
  const exact = models.find((m) => m.name.toLowerCase() === lower);
  if (exact) return exact;

  // Publisher/Repo match (e.g. "Qwen/Qwen3-4B")
  const byRepo = models.find(
    (m) => `${m.publisher}/${m.repo}`.toLowerCase() === lower,
  );
  if (byRepo) return byRepo;

  // Repo-only match (e.g. "Qwen3-4B")
  const byRepoOnly = models.find((m) => m.repo.toLowerCase() === lower);
  if (byRepoOnly) return byRepoOnly;

  // Substring match on name
  const partial = models.find((m) => m.name.toLowerCase().includes(lower));
  if (partial) return partial;

  return null;
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}
