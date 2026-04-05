/**
 * Prompt battery: send a fixed set of prompts to two Ollama models
 * and report whether their responses are meaningfully similar.
 *
 * This catches the "it used to get this right and now it hallucinates"
 * class of regressions that perplexity numbers miss. It's subjective by
 * nature — we're not trying to prove mathematical equivalence, just
 * flag obvious divergences so the user can eyeball them.
 *
 * Scoring: token-overlap Jaccard similarity on normalized text.
 * Semantic similarity would be more accurate but needs a local embedding
 * model we don't want to ship. Token overlap is crude but catches the
 * gross cases (completely different answers, hallucinated facts, etc.)
 * which are exactly what users care about.
 */

const OLLAMA_URL = process.env.OLLAMA_HOST || "http://localhost:11434";

/**
 * Curated prompts covering a range of capabilities that regression-test
 * well. Deliberately short and answerable — we're probing behavior, not
 * testing knowledge.
 */
export const DEFAULT_PROMPTS: string[] = [
  "What is the capital of France?",
  "Write a single sentence describing the color blue.",
  "What is 17 times 13?",
  "Name three primary colors.",
  "Translate 'hello' to Spanish.",
  "Complete this sentence: The early bird catches the ___",
  "Is water wet? Answer yes or no.",
  "What comes after Wednesday?",
  "Write one word that rhymes with 'cat'.",
  "Count from 1 to 5.",
];

export interface PromptResult {
  prompt: string;
  originalResponse: string;
  compressedResponse: string;
  similarity: number;
  diverged: boolean;
}

export interface BatteryResult {
  total: number;
  matching: number;
  diverged: number;
  details: PromptResult[];
}

/**
 * Strip reasoning/thinking blocks from a response so we compare actual
 * answers, not chain-of-thought. Reasoning models like Qwen3 and
 * DeepSeek-R1 emit long `<think>...</think>` sections before the real
 * answer, and the thinking text is nondeterministic enough that two
 * variants of the same model will never produce identical reasoning
 * even at temperature=0.
 *
 * Handles the common wrappers: <think>, <thinking>, and <reasoning>.
 */
export function stripThinkBlocks(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, " ")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, " ")
    .trim();
}

/**
 * Normalize a response for comparison: strip reasoning blocks, lowercase,
 * strip punctuation, collapse whitespace, split into tokens. Drops common
 * filler words that don't contribute signal.
 */
export function tokenize(text: string): Set<string> {
  const stopwords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "to", "of", "in", "on", "at", "by", "for", "with", "as", "it", "this",
    "that", "and", "or", "but", "so", "yes", "no",
  ]);
  const stripped = stripThinkBlocks(text);
  const cleaned = stripped
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned.split(" ").filter((t) => t && !stopwords.has(t));
  return new Set(tokens);
}

/**
 * Jaccard similarity between two token sets. Returns 0 when both are
 * empty (treating "no response" as maximally divergent from a response).
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

async function generateOllama(
  model: string,
  prompt: string,
  timeoutMs = 90000,
): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        // Reasoning models burn hundreds of tokens inside <think> blocks
        // before they emit the actual answer, so we give them headroom.
        // Stripping the thinking text happens downstream in tokenize().
        num_predict: 512,
        temperature: 0, // Deterministic — fair comparison between variants
        seed: 42,
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama /api/generate returned ${res.status}`);
  const data = (await res.json()) as { response?: string };
  return (data.response || "").trim();
}

/**
 * Run the prompt battery against both models. Uses temperature=0 and a
 * fixed seed so the comparison is as deterministic as Ollama can be.
 *
 * Similarity threshold: a Jaccard score below 0.25 on the non-stopword
 * tokens is considered a meaningful divergence. Calibrated empirically
 * so "Paris" vs "Paris is the capital of France" passes but "Paris" vs
 * "The Eiffel Tower" fails.
 */
export async function runPromptBattery(
  originalModel: string,
  compressedModel: string,
  prompts: string[] = DEFAULT_PROMPTS,
  onProgress?: (done: number, total: number) => void,
): Promise<BatteryResult> {
  const details: PromptResult[] = [];
  const DIVERGENCE_THRESHOLD = 0.25;

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    let originalResponse = "";
    let compressedResponse = "";
    try {
      originalResponse = await generateOllama(originalModel, prompt);
    } catch {
      originalResponse = "";
    }
    try {
      compressedResponse = await generateOllama(compressedModel, prompt);
    } catch {
      compressedResponse = "";
    }

    const origTokens = tokenize(originalResponse);
    const cxTokens = tokenize(compressedResponse);
    const similarity = jaccardSimilarity(origTokens, cxTokens);
    const diverged =
      similarity < DIVERGENCE_THRESHOLD ||
      compressedResponse.length === 0;

    details.push({
      prompt,
      originalResponse,
      compressedResponse,
      similarity,
      diverged,
    });

    onProgress?.(i + 1, prompts.length);
  }

  const matching = details.filter((d) => !d.diverged).length;
  return {
    total: prompts.length,
    matching,
    diverged: details.length - matching,
    details,
  };
}
