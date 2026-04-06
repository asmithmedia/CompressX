import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  inferQuantFromFilename,
  scanLMStudioModels,
  findLMStudioModel,
} from "../src/core/lmstudio-scanner.js";

// ---- inferQuantFromFilename tests (pure, no filesystem) ----

describe("inferQuantFromFilename", () => {
  it("extracts quant from dash-separated names", () => {
    expect(inferQuantFromFilename("qwen3-4b-q4_k_m.gguf")).toBe("q4_k_m");
    expect(inferQuantFromFilename("model-Q8_0.gguf")).toBe("q8_0");
    expect(inferQuantFromFilename("llama-q2_k.gguf")).toBe("q2_k");
  });

  it("extracts quant from dot-separated names", () => {
    expect(inferQuantFromFilename("model.q5_k_m.gguf")).toBe("q5_k_m");
  });

  it("extracts quant from underscore-separated names", () => {
    expect(inferQuantFromFilename("model_q3_k_m.gguf")).toBe("q3_k_m");
  });

  it("extracts f16 and f32", () => {
    expect(inferQuantFromFilename("model-f16.gguf")).toBe("f16");
    expect(inferQuantFromFilename("model-f32.gguf")).toBe("f32");
  });

  it("extracts IQ quants", () => {
    expect(inferQuantFromFilename("model-iq2_xxs.gguf")).toBe("iq2_xxs");
    expect(inferQuantFromFilename("model-IQ2_XS.gguf")).toBe("iq2_xs");
  });

  it("returns null for names without a quant suffix", () => {
    expect(inferQuantFromFilename("model.gguf")).toBeNull();
    expect(inferQuantFromFilename("qwen3-4b.gguf")).toBeNull();
    expect(inferQuantFromFilename("readme.txt")).toBeNull();
  });

  it("returns null for unrecognized quant formats", () => {
    // "q99" is not in the BITS_PER_WEIGHT table
    expect(inferQuantFromFilename("model-q99.gguf")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(inferQuantFromFilename("MODEL-Q4_K_M.GGUF")).toBe("q4_k_m");
  });
});

// ---- Filesystem-based scanner tests ----

const FIXTURE_ROOT = join(tmpdir(), `compressx-lms-test-${Date.now()}`);

beforeAll(() => {
  // Create a mock LM Studio models directory:
  //   Publisher1/
  //     RepoA/
  //       model-q4_k_m.gguf   (1000 bytes)
  //       model-q8_0.gguf     (2000 bytes)
  //     RepoB/
  //       another.gguf        (500 bytes, no quant in name)
  //   Publisher2/
  //     RepoC/
  //       big-f16.gguf        (5000 bytes)

  const dirs = [
    join(FIXTURE_ROOT, "Publisher1", "RepoA"),
    join(FIXTURE_ROOT, "Publisher1", "RepoB"),
    join(FIXTURE_ROOT, "Publisher2", "RepoC"),
  ];
  for (const d of dirs) mkdirSync(d, { recursive: true });

  writeFileSync(join(dirs[0], "model-q4_k_m.gguf"), Buffer.alloc(1000));
  writeFileSync(join(dirs[0], "model-q8_0.gguf"), Buffer.alloc(2000));
  writeFileSync(join(dirs[1], "another.gguf"), Buffer.alloc(500));
  writeFileSync(join(dirs[2], "big-f16.gguf"), Buffer.alloc(5000));

  // Point the scanner at our fixture
  process.env.LM_STUDIO_MODELS = FIXTURE_ROOT;
});

afterAll(() => {
  delete process.env.LM_STUDIO_MODELS;
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });
});

describe("scanLMStudioModels", () => {
  it("finds all GGUF files in the fixture directory", () => {
    const models = scanLMStudioModels();
    expect(models.length).toBe(4);
  });

  it("correctly parses publisher and repo from directory structure", () => {
    const models = scanLMStudioModels();
    const q4 = models.find((m) => m.name.includes("q4_k_m"));
    expect(q4).not.toBeNull();
    expect(q4!.publisher).toBe("Publisher1");
    expect(q4!.repo).toBe("RepoA");
  });

  it("infers quant from filenames", () => {
    const models = scanLMStudioModels();
    const q4 = models.find((m) => m.name.includes("q4_k_m"));
    const q8 = models.find((m) => m.name.includes("q8_0"));
    const noQuant = models.find((m) => m.name.includes("another"));
    const f16 = models.find((m) => m.name.includes("f16"));

    expect(q4!.inferredQuant).toBe("q4_k_m");
    expect(q8!.inferredQuant).toBe("q8_0");
    expect(noQuant!.inferredQuant).toBeNull();
    expect(f16!.inferredQuant).toBe("f16");
  });

  it("reports correct file sizes", () => {
    const models = scanLMStudioModels();
    const big = models.find((m) => m.name.includes("big"));
    expect(big!.sizeBytes).toBe(5000);
  });

  it("builds sensible display names", () => {
    const models = scanLMStudioModels();
    const q4 = models.find((m) => m.name.includes("q4_k_m"));
    expect(q4!.displayName).toBe("RepoA (Q4_K_M)");
  });

  it("sorts by publisher then size descending", () => {
    const models = scanLMStudioModels();
    // Publisher1 has 3 files, Publisher2 has 1
    // Within Publisher1: q8_0 (2000) > q4_k_m (1000) > another (500)
    const pub1 = models.filter((m) => m.publisher === "Publisher1");
    expect(pub1[0].sizeBytes).toBeGreaterThanOrEqual(pub1[1].sizeBytes);
    expect(pub1[1].sizeBytes).toBeGreaterThanOrEqual(pub1[2].sizeBytes);
  });

  it("returns empty array when directory does not exist", () => {
    const orig = process.env.LM_STUDIO_MODELS;
    process.env.LM_STUDIO_MODELS = "/nonexistent/path/12345";
    const models = scanLMStudioModels();
    expect(models).toEqual([]);
    process.env.LM_STUDIO_MODELS = orig;
  });
});

describe("findLMStudioModel", () => {
  it("finds by full path", () => {
    const m = findLMStudioModel("Publisher1/RepoA/model-q4_k_m.gguf");
    expect(m).not.toBeNull();
    expect(m!.inferredQuant).toBe("q4_k_m");
  });

  it("finds by Publisher/Repo", () => {
    const m = findLMStudioModel("Publisher2/RepoC");
    expect(m).not.toBeNull();
    expect(m!.publisher).toBe("Publisher2");
  });

  it("finds by repo name only", () => {
    const m = findLMStudioModel("RepoB");
    expect(m).not.toBeNull();
    expect(m!.repo).toBe("RepoB");
  });

  it("is case-insensitive", () => {
    const m = findLMStudioModel("publisher1/repoa");
    expect(m).not.toBeNull();
  });

  it("returns null for non-existent model", () => {
    expect(findLMStudioModel("NonExistent/Model")).toBeNull();
  });
});
