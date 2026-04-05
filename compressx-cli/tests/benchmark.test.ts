import { describe, it, expect } from "vitest";
import {
  parseLlamaBenchOutput,
  parsePerplexityOutput,
} from "../src/core/benchmark.js";

describe("parseLlamaBenchOutput", () => {
  it("parses a typical CUDA llama-bench markdown table", () => {
    const stdout = `
ggml_cuda_init: found 1 CUDA devices
| model                          |       size |     params | backend    | ngl |          test |                  t/s |
| ------------------------------ | ---------: | ---------: | ---------- | --: | ------------: | -------------------: |
| llama 7B Q4_K - Medium         |   3.80 GiB |     6.74 B | CUDA       |  99 |         pp512 |       1324.80 ± 12.3 |
| llama 7B Q4_K - Medium         |   3.80 GiB |     6.74 B | CUDA       |  99 |         tg128 |         48.62 ± 0.45 |

build: abc123 (8660)
`;
    const r = parseLlamaBenchOutput(stdout);
    expect(r.promptEvalTokensPerSec).toBeGreaterThan(1000);
    expect(r.generationTokensPerSec).toBeGreaterThan(40);
    expect(r.generationTokensPerSec).toBeLessThan(60);
  });

  it("parses a CPU llama-bench table", () => {
    const stdout = `
| model     | size     | params | backend | test   |      t/s |
| --------- | -------: | -----: | ------- | -----: | -------: |
| llama 1B  | 660 MiB  | 1.1 B  | CPU     |  pp128 |   142.31 |
| llama 1B  | 660 MiB  | 1.1 B  | CPU     |   tg32 |    18.94 |
`;
    const r = parseLlamaBenchOutput(stdout);
    expect(r.promptEvalTokensPerSec).toBeCloseTo(142.31, 1);
    expect(r.generationTokensPerSec).toBeCloseTo(18.94, 1);
  });

  it("returns zeros when output contains no table", () => {
    const r = parseLlamaBenchOutput("some error message with no table");
    expect(r.promptEvalTokensPerSec).toBe(0);
    expect(r.generationTokensPerSec).toBe(0);
  });

  it("ignores header/separator rows", () => {
    // The first row has text like "t/s" in it — make sure we don't parse it as data
    const stdout = `
| model | backend | test | t/s |
| ----- | ------- | ---- | --- |
| x | CPU | tg32 | 25.0 |
`;
    const r = parseLlamaBenchOutput(stdout);
    expect(r.generationTokensPerSec).toBe(25.0);
  });
});

describe("parsePerplexityOutput", () => {
  it("parses the final estimate line", () => {
    const stdout = `
main: build = 8660
perplexity : calculating perplexity over 1 chunks
[1]7.4217
Final estimate: PPL = 7.4217 +/- 0.04891

llama_print_timings:        load time = 1200 ms
`;
    expect(parsePerplexityOutput(stdout)).toBeCloseTo(7.4217, 3);
  });

  it("falls back to the last chunk reading when there is no Final estimate", () => {
    const stdout = `
perplexity: calculating
[1]5.8234,[2]6.1015,[3]6.3892,
`;
    expect(parsePerplexityOutput(stdout)).toBeCloseTo(6.3892, 3);
  });

  it("returns null for empty or unrelated output", () => {
    expect(parsePerplexityOutput("")).toBeNull();
    expect(parsePerplexityOutput("error: something broke")).toBeNull();
  });

  it("is case-insensitive on the 'Final estimate' prefix", () => {
    const stdout = "final ESTIMATE: PPL = 9.12 +/- 0.05";
    expect(parsePerplexityOutput(stdout)).toBeCloseTo(9.12, 2);
  });
});
