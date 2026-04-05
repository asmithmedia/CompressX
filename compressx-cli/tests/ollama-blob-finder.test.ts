import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findLocalBlob } from "../src/core/ollama-blob-finder.js";

const FIXTURE_ROOT = join(tmpdir(), `compressx-test-${Date.now()}`);

// The blob finder uses the OLLAMA_MODELS env var when set, so we can
// create a fake Ollama layout in a temp directory and point the module
// at it for the duration of these tests.
beforeAll(() => {
  const manifestDir = join(
    FIXTURE_ROOT,
    "manifests",
    "registry.ollama.ai",
    "library",
    "fake-model",
  );
  const blobDir = join(FIXTURE_ROOT, "blobs");
  mkdirSync(manifestDir, { recursive: true });
  mkdirSync(blobDir, { recursive: true });

  // Minimal OCI manifest with a GGUF layer
  const manifest = {
    schemaVersion: 2,
    layers: [
      {
        mediaType: "application/vnd.ollama.image.model",
        digest: "sha256:deadbeefcafebabe1234567890abcdef1234567890abcdef1234567890abcdef",
        size: 12345,
      },
      {
        mediaType: "application/vnd.ollama.image.template",
        digest: "sha256:templatedigest",
        size: 100,
      },
    ],
  };
  writeFileSync(join(manifestDir, "1b"), JSON.stringify(manifest));

  // Create the fake blob file
  writeFileSync(
    join(
      blobDir,
      "sha256-deadbeefcafebabe1234567890abcdef1234567890abcdef1234567890abcdef",
    ),
    Buffer.alloc(12345),
  );

  process.env.OLLAMA_MODELS = FIXTURE_ROOT;
});

afterAll(() => {
  delete process.env.OLLAMA_MODELS;
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });
});

describe("findLocalBlob", () => {
  it("finds a blob for an installed model", () => {
    const result = findLocalBlob("fake-model:1b");
    expect(result).not.toBeNull();
    expect(result!.sizeBytes).toBe(12345);
    expect(result!.blobPath).toContain("sha256-deadbeef");
  });

  it("returns null for a non-existent model", () => {
    expect(findLocalBlob("nonexistent:model")).toBeNull();
  });

  it("returns null for a model with no tag when no :latest exists", () => {
    // "fake-model" with no tag defaults to :latest which doesn't exist in the fixture
    expect(findLocalBlob("fake-model")).toBeNull();
  });

  it("never throws, even on corrupt inputs", () => {
    // Various pathological inputs should all return null, not crash
    expect(() => findLocalBlob("")).not.toThrow();
    expect(() => findLocalBlob("///")).not.toThrow();
    expect(() => findLocalBlob("a:b:c:d")).not.toThrow();
  });
});
