import { describe, it, expect } from "vitest";

// The isNewer function is not exported directly from update-notifier.ts,
// but the logic is simple enough to re-test here. If this duplication
// becomes annoying we can export isNewer for testing.
function isNewer(current: string, latest: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/^v/, "")
      .split("-")[0]
      .split(".")
      .map((n) => parseInt(n, 10) || 0);
  const a = parse(current);
  const b = parse(latest);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (bi > ai) return true;
    if (bi < ai) return false;
  }
  return false;
}

describe("isNewer (semver comparison)", () => {
  it("detects major version bumps", () => {
    expect(isNewer("0.5.1", "1.0.0")).toBe(true);
  });

  it("detects minor version bumps", () => {
    expect(isNewer("0.5.1", "0.6.0")).toBe(true);
    expect(isNewer("0.5.1", "0.5.2")).toBe(true);
  });

  it("returns false for same version", () => {
    expect(isNewer("0.5.1", "0.5.1")).toBe(false);
  });

  it("returns false for older version", () => {
    expect(isNewer("0.5.1", "0.4.9")).toBe(false);
    expect(isNewer("1.0.0", "0.9.9")).toBe(false);
  });

  it("handles v prefix", () => {
    expect(isNewer("v0.5.1", "v0.6.0")).toBe(true);
  });

  it("ignores pre-release tags", () => {
    expect(isNewer("0.5.1", "0.5.2-beta.1")).toBe(true);
    expect(isNewer("0.5.2-beta.1", "0.5.2")).toBe(false);
  });

  it("handles missing patch version", () => {
    expect(isNewer("0.5", "0.6")).toBe(true);
  });
});
