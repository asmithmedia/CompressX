import { describe, it, expect } from "vitest";
import {
  parseTensorLine,
  formatDuration,
  TENSOR_PROGRESS_REGEX,
} from "../src/core/progress-quantize.js";

describe("parseTensorLine", () => {
  it("parses a canonical llama-quantize progress line", () => {
    const line =
      "[   1/ 291]                    token_embd.weight - [ 4096, 128256,    1,    1], type =    f16, converting to q4_K .. size =  1000.00 MiB ->   281.25 MiB";
    const r = parseTensorLine(line);
    expect(r).not.toBeNull();
    expect(r!.done).toBe(1);
    expect(r!.total).toBe(291);
    expect(r!.name).toBe("token_embd.weight");
  });

  it("parses a line without padding spaces", () => {
    const r = parseTensorLine("[15/100] blk.0.attn_q.weight - [...]");
    expect(r).toEqual({ done: 15, total: 100, name: "blk.0.attn_q.weight" });
  });

  it("parses the final tensor of a run", () => {
    const r = parseTensorLine("[ 291/ 291] output.weight - [...] type = f16");
    expect(r).toEqual({ done: 291, total: 291, name: "output.weight" });
  });

  it("returns null for non-progress lines", () => {
    expect(parseTensorLine("llama_model_loader: loaded meta data")).toBeNull();
    expect(parseTensorLine("")).toBeNull();
    expect(parseTensorLine("main: quantizing")).toBeNull();
    expect(parseTensorLine("[info] something")).toBeNull();
  });

  it("is anchored to the start of the line", () => {
    // Avoid matching bracketed text mid-line (would cause phantom progress jumps)
    expect(parseTensorLine("note: see [   1/ 291] in logs")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats seconds as m:ss with zero-padding", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(600)).toBe("10:00");
    expect(formatDuration(3725)).toBe("62:05");
  });

  it("handles NaN and negatives gracefully", () => {
    expect(formatDuration(NaN)).toBe("--:--");
    expect(formatDuration(-1)).toBe("--:--");
    expect(formatDuration(Infinity)).toBe("--:--");
  });
});

describe("TENSOR_PROGRESS_REGEX", () => {
  it("matches only at start of line", () => {
    expect(TENSOR_PROGRESS_REGEX.test("[ 1/ 2] foo")).toBe(true);
    expect(TENSOR_PROGRESS_REGEX.test(" [ 1/ 2] foo")).toBe(false);
  });
});
