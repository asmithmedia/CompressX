/**
 * Post-compression smoke test for Ollama-deployed models.
 *
 * After a compression finishes and we register the -cx variant in
 * Ollama, this module runs a single short inference request against
 * the new model and inspects the output for obvious failure modes:
 *
 *   - No output at all (model won't generate)
 *   - Immediate EOS (template mismatch, zero tokens)
 *   - Token-level repetition (5+ identical 3-grams within the output,
 *     the classic symptom of over-quantization breaking a reasoning
 *     model — the exact failure the user hit with qwen3:8b @ Q2_K)
 *   - Gibberish / no real words (tokenizer mismatch from a bad
 *     Modelfile template, the classic symptom of the template
 *     inheritance bug we fixed in v0.5.0)
 *
 * The smoke test is advisory: it never blocks the compression or
 * auto-deletes the variant. It just prints a yellow warning if it
 * thinks the output looks wrong, so the user knows to try a safer
 * quant before discovering the problem in production.
 */

import chalk from "chalk";
import ora from "ora";

const OLLAMA_URL = process.env.OLLAMA_HOST || "http://localhost:11434";
const SMOKE_PROMPT = "Reply with only the word 'hello' and nothing else.";
const SMOKE_TIMEOUT_MS = 45_000; // reasoning models are slow; give them room

interface SmokeResult {
  ok: boolean;
  reason?: string;
  responsePreview?: string;
}

/**
 * Detect token-level repetition: any 3-gram that repeats more than
 * `threshold` times in the response. This is the fingerprint of an
 * over-quantized model stuck in a loop, e.g.:
 *   "Let me think about that. Let me think about that. Let me think..."
 */
function hasRepetition(text: string, threshold = 4): boolean {
  // Tokenize on whitespace — good enough for this heuristic
  const tokens = text
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}"']/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length < 12) return false;

  const trigramCounts = new Map<string, number>();
  for (let i = 0; i < tokens.length - 2; i++) {
    const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
    trigramCounts.set(trigram, (trigramCounts.get(trigram) || 0) + 1);
  }

  for (const count of trigramCounts.values()) {
    if (count > threshold) return true;
  }
  return false;
}

/**
 * Detect gibberish — output that contains no recognizable words.
 * A broken tokenizer template tends to produce streams of partial
 * words, symbols, or non-ASCII noise. We check for a minimum ratio
 * of "wordlike" tokens (alphabetic strings of 2+ chars).
 */
function isGibberish(text: string): boolean {
  if (text.trim().length < 10) return false; // too short to judge
  const tokens = text.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length < 5) return false;
  const wordlike = tokens.filter((t) => /^[a-zA-Z]{2,}$/.test(t));
  const ratio = wordlike.length / tokens.length;
  return ratio < 0.3;
}

export async function runSmokeTest(ollamaModelName: string): Promise<SmokeResult> {
  const spinner = ora("Running smoke test...").start();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SMOKE_TIMEOUT_MS);

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModelName,
        prompt: SMOKE_PROMPT,
        stream: false,
        think: false,
        options: {
          num_predict: 80,
          temperature: 0.3,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      spinner.warn("Smoke test skipped (Ollama API error)");
      return { ok: true, reason: `HTTP ${res.status}` }; // advisory, not fatal
    }

    const data = (await res.json()) as {
      response?: string;
      thinking?: string;
      eval_count?: number;
      done_reason?: string;
    };

    // For thinking models, the actual output often lives in `thinking`
    // field when `think: false` is ignored by older Ollama versions
    const output = (data.response || "").trim() || (data.thinking || "").trim();
    const tokens = data.eval_count || 0;

    // Check 1: did the model generate anything?
    if (tokens === 0 || output.length === 0) {
      spinner.fail("Smoke test failed: model generated no output");
      return {
        ok: false,
        reason: "no output generated (possible template mismatch)",
      };
    }

    // Check 2: token-level repetition
    if (hasRepetition(output)) {
      spinner.fail("Smoke test failed: output is repeating");
      return {
        ok: false,
        reason:
          "detected token-level repetition (classic symptom of over-quantization)",
        responsePreview: output.slice(0, 200),
      };
    }

    // Check 3: gibberish / tokenizer issues
    if (isGibberish(output)) {
      spinner.fail("Smoke test failed: output looks like gibberish");
      return {
        ok: false,
        reason:
          "output has few recognizable words (possible template or tokenizer mismatch)",
        responsePreview: output.slice(0, 200),
      };
    }

    spinner.succeed(`Smoke test passed (${tokens} tokens generated)`);
    return { ok: true, responsePreview: output.slice(0, 120) };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      spinner.warn("Smoke test timed out");
      return {
        ok: false,
        reason:
          "timed out after 45s (model may be stuck; very large models can legitimately take longer)",
      };
    }
    // Network errors etc. shouldn't block the compression summary
    spinner.warn("Smoke test skipped (network error)");
    return { ok: true, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Print a helpful remediation block when a smoke test fails. Tells the
 * user what likely went wrong, shows the bad output, and suggests the
 * next command to try.
 */
export function printSmokeFailureHelp(
  cxName: string,
  sourceModel: string,
  currentQuant: string,
  result: SmokeResult,
) {
  console.log();
  console.log(chalk.yellow.bold("  The compressed model may not be usable."));
  console.log(chalk.gray(`  ${result.reason}`));

  if (result.responsePreview) {
    console.log();
    console.log(chalk.gray("  Sample output:"));
    console.log(chalk.gray(`    "${result.responsePreview.replace(/\n/g, " ")}"`));
  }

  console.log();
  console.log(chalk.white("  What to do:"));
  console.log(chalk.gray(`    1. Delete the broken variant:`));
  console.log(chalk.cyan(`       ollama rm ${cxName}`));
  console.log(chalk.gray(`    2. Try a less aggressive quant (Q4_0 is the safe floor for reasoning models):`));
  console.log(chalk.cyan(`       compressx compress ${sourceModel} -q q4_0`));
  console.log(chalk.gray(`    3. Or use --from-source for pristine weights:`));
  console.log(chalk.cyan(`       compressx compress ${sourceModel} -q ${currentQuant} --from-source`));
  console.log();
}
