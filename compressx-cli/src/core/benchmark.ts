import { spawnSync } from "node:child_process";
import { writeFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PERPLEXITY_CORPUS } from "./perplexity-corpus.js";

/**
 * Benchmark core: runs llama-bench and llama-perplexity against a GGUF
 * file and returns structured results. Thin wrappers around the
 * official llama.cpp tools — we just parse their output.
 *
 * Why these two tools?
 *   - llama-bench reports prompt-eval tok/s and generation tok/s
 *     separately, which is the right granularity because quantization
 *     affects them differently (memory-bound for gen, compute-bound for
 *     prompt eval).
 *   - llama-perplexity reports the classical information-theoretic
 *     quality metric. It's the same metric the llama.cpp README uses
 *     when they publish quant quality comparisons, so users can cross-
 *     reference against the community wisdom.
 *
 * We deliberately skip evaluation harnesses (MMLU, HellaSwag, etc.) —
 * those take too long for an instant-feedback CLI and need extra
 * Python deps. See AGENTS.md / CLAUDE.md for scope rationale.
 */

export interface BenchResult {
  /** Prompt eval tokens/sec (how fast it ingests input). */
  promptEvalTokensPerSec: number;
  /** Generation tokens/sec (how fast it produces output). */
  generationTokensPerSec: number;
  /** Wall-clock load time in seconds. */
  loadTimeSec: number;
  /** Raw captured stdout for debugging. */
  raw: string;
}

export interface PerplexityResult {
  /** The final perplexity score. Lower is better. */
  perplexity: number;
  /** Raw captured stdout. */
  raw: string;
}

/**
 * Parse llama-bench output. The tool emits a markdown table with columns
 * like:
 *
 *   | model            | size    | params | backend | test    |        t/s |
 *   | ---------------- | ------- | ------ | ------- | ------- | ---------: |
 *   | llama 7B Q4_K_M  |  3.8 GB |  7B    | CUDA    | pp512   |  1324.8    |
 *   | llama 7B Q4_K_M  |  3.8 GB |  7B    | CUDA    | tg128   |    48.6    |
 *
 * pp = prompt processing, tg = text generation. We pluck the "t/s"
 * column from the matching rows.
 */
export function parseLlamaBenchOutput(stdout: string): {
  promptEvalTokensPerSec: number;
  generationTokensPerSec: number;
} {
  const lines = stdout.split("\n");
  let pp = 0;
  let tg = 0;

  for (const line of lines) {
    // Each data row has pipes and ends with a numeric t/s value
    if (!line.includes("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // Look for the "test" column containing pp or tg and a trailing t/s
    const testCell = cells.find((c) => /^(pp|tg)\d+/i.test(c));
    if (!testCell) continue;
    // t/s is typically in the last or second-to-last non-empty cell
    const numericCells = cells.filter((c) => /^\d+(\.\d+)?/.test(c));
    const tsCell = numericCells[numericCells.length - 1];
    if (!tsCell) continue;
    const value = parseFloat(tsCell);
    if (!isFinite(value)) continue;
    if (testCell.toLowerCase().startsWith("pp")) pp = value;
    if (testCell.toLowerCase().startsWith("tg")) tg = value;
  }

  return { promptEvalTokensPerSec: pp, generationTokensPerSec: tg };
}

/**
 * Parse the final perplexity from llama-perplexity output. The tool
 * emits incremental lines during the run and a final summary like:
 *
 *   Final estimate: PPL = 7.4217 +/- 0.04891
 *
 * We grab the number after "PPL =". If there's no Final estimate we
 * fall back to the last "[NN]X.XXXX," style chunk value we can find.
 */
export function parsePerplexityOutput(stdout: string): number | null {
  // Primary: "Final estimate: PPL = 7.4217 +/- 0.04891"
  const finalMatch = stdout.match(/Final estimate:\s*PPL\s*=\s*([\d.]+)/i);
  if (finalMatch) {
    const v = parseFloat(finalMatch[1]);
    if (isFinite(v)) return v;
  }

  // Fallback: look for the last "[NN]X.XXXX," style chunk reading.
  // llama-perplexity emits one per processed chunk.
  const chunks = [...stdout.matchAll(/\[\d+\]([\d.]+),/g)];
  if (chunks.length > 0) {
    const last = parseFloat(chunks[chunks.length - 1][1]);
    if (isFinite(last)) return last;
  }

  return null;
}

/**
 * Run llama-bench against a GGUF file. Uses short pp/tg sequences
 * (pp128, tg32) to keep the total runtime under ~20 seconds on
 * reasonably-sized models. Users who want a more rigorous benchmark
 * can run llama-bench manually with custom flags.
 */
export function runLlamaBench(
  benchBinary: string,
  ggufPath: string,
  timeoutMs = 300_000,
): BenchResult {
  const result = spawnSync(
    benchBinary,
    // -p = prompt sizes, -n = generation sizes, -r = repetitions
    // Short sequences keep this well under a minute on most models.
    ["-m", ggufPath, "-p", "128", "-n", "32", "-r", "2"],
    { stdio: "pipe", timeout: timeoutMs, encoding: "utf-8" },
  );

  const stdout = result.stdout || "";
  const parsed = parseLlamaBenchOutput(stdout);

  return {
    promptEvalTokensPerSec: parsed.promptEvalTokensPerSec,
    generationTokensPerSec: parsed.generationTokensPerSec,
    // llama-bench doesn't report load time directly; we approximate as
    // the difference between wall and compute time, but here we return
    // 0 and let the caller optionally measure wall time around the call.
    loadTimeSec: 0,
    raw: stdout,
  };
}

/**
 * Run llama-perplexity against a GGUF file using the bundled corpus.
 * Writes the corpus to a temp file and runs perplexity in short-chunk
 * mode so small models complete in ~30-60 seconds.
 */
export function runPerplexity(
  perplexityBinary: string,
  ggufPath: string,
  timeoutMs = 600_000,
): PerplexityResult | null {
  // Write the corpus to a temp file llama-perplexity can read
  const corpusPath = join(tmpdir(), `compressx-perplexity-${Date.now()}.txt`);
  writeFileSync(corpusPath, PERPLEXITY_CORPUS, "utf-8");

  try {
    const result = spawnSync(
      perplexityBinary,
      [
        "-m",
        ggufPath,
        "-f",
        corpusPath,
        // Use a small context so tiny models (1-2B) also fit. llama.cpp
        // requires ctx >= chunk_size (512 by default) so 1024 is a safe
        // minimum that also keeps runtime short.
        "-c",
        "1024",
        "--chunks",
        "1",
      ],
      { stdio: "pipe", timeout: timeoutMs, encoding: "utf-8" },
    );

    if (result.status !== 0) return null;
    const stdout = (result.stdout || "") + "\n" + (result.stderr || "");
    const ppl = parsePerplexityOutput(stdout);
    if (ppl === null) return null;
    return { perplexity: ppl, raw: stdout };
  } catch {
    return null;
  }
}

/**
 * File size on disk, in GB. Returns 0 if the file doesn't exist.
 */
export function getFileSizeGb(path: string): number {
  if (!existsSync(path)) return 0;
  return statSync(path).size / 1e9;
}
