import { spawn } from "node:child_process";
import chalk from "chalk";

/**
 * Live progress bar for llama-quantize.
 *
 * llama.cpp's quantize binary writes one line per tensor to stderr in the
 * form:
 *
 *   [   1/ 291]           token_embd.weight - [ 4096, 128256,...], type = f16, size = 1000.00 MiB -> 281.25 MiB
 *
 * We parse the `[N/M]` prefix to drive a live bar with percent, tensors
 * done, elapsed time, and a simple linear ETA. On non-TTY output (CI,
 * piped logs) we fall back to milestone lines so the log stays readable.
 *
 * We avoid adding a new dep (cli-progress, etc.) — the bar is a few lines
 * of \r-rewriting and plays nicely with chalk colors.
 */
export interface QuantizeProgressOptions {
  binary: string;
  args: string[];
  timeoutMs?: number;
}

export interface QuantizeProgressResult {
  status: number;
  /** Full captured stderr, forwarded to the caller so failure messages stay intact. */
  stderr: string;
}

/** Matches the canonical "[   N/   M]  tensor.name" lines from llama-quantize. */
export const TENSOR_PROGRESS_REGEX = /^\[\s*(\d+)\s*\/\s*(\d+)\s*\]\s+(\S+)/;

/** Format a duration in seconds as m:ss. Returns "--:--" for NaN / negative. */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Parse a single line of llama-quantize stderr. Returns the tensor index
 * tuple if the line is a progress line, or null otherwise. Exposed for
 * unit tests.
 */
export function parseTensorLine(
  line: string,
): { done: number; total: number; name: string } | null {
  const m = TENSOR_PROGRESS_REGEX.exec(line);
  if (!m) return null;
  return { done: parseInt(m[1], 10), total: parseInt(m[2], 10), name: m[3] };
}

export function runQuantizeWithProgress(
  opts: QuantizeProgressOptions,
): Promise<QuantizeProgressResult> {
  return new Promise((resolvePromise) => {
    const proc = spawn(opts.binary, opts.args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const startedAt = Date.now();
    const isTty = process.stdout.isTTY === true;
    const barWidth = 28;

    let totalTensors = 0;
    let doneTensors = 0;
    let stderrBuffer = "";
    let stderrCapture = "";
    let lastRenderAt = 0;
    let lastMilestone = -10;

    const render = (force = false) => {
      const now = Date.now();
      if (!force && now - lastRenderAt < 120) return;
      lastRenderAt = now;
      if (totalTensors === 0) return;

      const pct = doneTensors / totalTensors;
      const elapsed = (now - startedAt) / 1000;
      const etaSec =
        doneTensors > 0 ? (elapsed / doneTensors) * (totalTensors - doneTensors) : 0;

      if (isTty) {
        const filled = Math.max(0, Math.min(barWidth, Math.round(pct * barWidth)));
        const bar =
          chalk.green("\u2588".repeat(filled)) +
          chalk.gray("\u2591".repeat(barWidth - filled));
        const line =
          `  ${bar}` +
          `  ${chalk.bold((pct * 100).toFixed(1).padStart(5) + "%")}` +
          chalk.gray(`  ${doneTensors}/${totalTensors} tensors`) +
          chalk.gray(`  ${formatDuration(elapsed)} elapsed`) +
          chalk.gray(`  eta ${formatDuration(etaSec)}`);
        // Clear to end-of-line and rewrite. Pad with spaces so shorter
        // lines don't leave stale characters behind from longer ones.
        const cols = process.stdout.columns || 120;
        process.stdout.write("\r" + line.slice(0, cols - 1).padEnd(cols - 1));
      } else {
        // Non-TTY: emit milestone lines every 10%.
        const bucket = Math.floor(pct * 10) * 10;
        if (bucket > lastMilestone) {
          lastMilestone = bucket;
          process.stdout.write(
            `  ${bucket}% (${doneTensors}/${totalTensors} tensors, ${formatDuration(elapsed)} elapsed)\n`,
          );
        }
      }
    };

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderrCapture += text;
      stderrBuffer += text;
      const lines = stderrBuffer.split("\n");
      stderrBuffer = lines.pop() || "";
      for (const line of lines) {
        const parsed = parseTensorLine(line);
        if (parsed) {
          doneTensors = parsed.done;
          totalTensors = parsed.total;
          render();
        }
      }
    });

    const timeout = opts.timeoutMs
      ? setTimeout(() => {
          try {
            proc.kill("SIGKILL");
          } catch {
            // ignore
          }
        }, opts.timeoutMs)
      : null;

    proc.on("exit", (code) => {
      if (timeout) clearTimeout(timeout);
      // Finalize the bar at 100% so the user sees a clean terminating state.
      if (isTty && totalTensors > 0) {
        doneTensors = totalTensors;
        render(true);
        process.stdout.write("\n");
      }
      resolvePromise({ status: code ?? 1, stderr: stderrCapture });
    });

    proc.on("error", (err) => {
      if (timeout) clearTimeout(timeout);
      stderrCapture += `\n${err.message}`;
      resolvePromise({ status: 1, stderr: stderrCapture });
    });
  });
}
