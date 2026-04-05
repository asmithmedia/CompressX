import { describe, it, expect } from "vitest";
import {
  tokenize,
  jaccardSimilarity,
  stripThinkBlocks,
} from "../src/core/prompt-battery.js";

describe("stripThinkBlocks", () => {
  it("strips a single think block", () => {
    const s = stripThinkBlocks("<think>reasoning here</think>Paris.");
    expect(s).toBe("Paris.");
  });

  it("strips multi-line reasoning blocks", () => {
    const s = stripThinkBlocks(
      "<think>\nLet me think...\nthe user asked for\na capital city\n</think>\nParis",
    );
    expect(s.toLowerCase()).toContain("paris");
    expect(s.toLowerCase()).not.toContain("reasoning");
    expect(s.toLowerCase()).not.toContain("think");
  });

  it("handles the <thinking> variant", () => {
    expect(stripThinkBlocks("<thinking>x</thinking>Paris")).toBe("Paris");
  });

  it("is a no-op on text without think blocks", () => {
    expect(stripThinkBlocks("Paris is the capital.")).toBe("Paris is the capital.");
  });

  it("handles qwen3 actually producing think-block-then-answer", () => {
    // A realistic qwen3 output: a long think block followed by a one-line answer.
    const raw = `<think>
The user is asking about the capital of France. That's a well-known geography fact.
The capital of France is Paris.
</think>

Paris`;
    const stripped = stripThinkBlocks(raw);
    // We want the final answer intact and nothing from inside the block
    const tokens = tokenize(stripped);
    expect(tokens.has("paris")).toBe(true);
    expect(tokens.has("user")).toBe(false);
    expect(tokens.has("asking")).toBe(false);
  });
});

describe("tokenize", () => {
  it("lowercases and strips punctuation", () => {
    const tokens = tokenize("Hello, World! Hello.");
    expect(tokens.has("hello")).toBe(true);
    expect(tokens.has("world")).toBe(true);
    expect(tokens.has("Hello")).toBe(false); // lowercased
  });

  it("drops common stopwords", () => {
    const tokens = tokenize("The cat is on the mat");
    expect(tokens.has("cat")).toBe(true);
    expect(tokens.has("mat")).toBe(true);
    expect(tokens.has("the")).toBe(false);
    expect(tokens.has("is")).toBe(false);
    expect(tokens.has("on")).toBe(false);
  });

  it("handles empty input", () => {
    expect(tokenize("").size).toBe(0);
    expect(tokenize("the is a").size).toBe(0); // all stopwords
  });
});

describe("jaccardSimilarity", () => {
  it("returns 1 for identical token sets", () => {
    const a = new Set(["paris", "france", "capital"]);
    const b = new Set(["paris", "france", "capital"]);
    expect(jaccardSimilarity(a, b)).toBe(1);
  });

  it("returns 0 for disjoint sets", () => {
    const a = new Set(["apple", "banana"]);
    const b = new Set(["carrot", "daikon"]);
    expect(jaccardSimilarity(a, b)).toBe(0);
  });

  it("returns the correct middle value for partial overlap", () => {
    const a = new Set(["a", "b", "c"]);
    const b = new Set(["b", "c", "d"]);
    // intersection: 2 (b, c); union: 4 (a, b, c, d); Jaccard = 0.5
    expect(jaccardSimilarity(a, b)).toBe(0.5);
  });

  it("returns 0 when both sets are empty (empty response = divergence)", () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(0);
  });

  it("passes the calibration test: 'Paris' vs long answer", () => {
    const short = tokenize("Paris.");
    const long = tokenize("Paris is the capital of France.");
    // After stopword removal: {paris} vs {paris, capital, france}
    // Jaccard = 1/3 ≈ 0.33 — above our 0.25 divergence threshold
    expect(jaccardSimilarity(short, long)).toBeGreaterThan(0.25);
  });

  it("passes the calibration test: 'Paris' vs wrong answer", () => {
    const correct = tokenize("Paris");
    const wrong = tokenize("The Eiffel Tower");
    // {paris} vs {eiffel, tower} — disjoint, Jaccard = 0
    expect(jaccardSimilarity(correct, wrong)).toBe(0);
  });
});
