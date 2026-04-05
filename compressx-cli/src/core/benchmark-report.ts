import chalk from "chalk";
import type { BenchResult, PerplexityResult } from "./benchmark.js";
import type { BatteryResult } from "./prompt-battery.js";

/**
 * Rendering + assessment layer for benchmark results. Separates the
 * "measure" work (benchmark.ts, prompt-battery.ts) from the
 * "interpret and print" work so tests can import pure functions
 * without triggering any I/O.
 */

export interface BenchmarkReport {
  originalLabel: string;
  compressedLabel: string;
  originalSizeGb: number;
  compressedSizeGb: number;
  originalBench: BenchResult | null;
  compressedBench: BenchResult | null;
  originalPerplexity: PerplexityResult | null;
  compressedPerplexity: PerplexityResult | null;
  battery: BatteryResult | null;
}

export interface Assessment {
  verdict: "excellent" | "good" | "acceptable" | "risky";
  headline: string;
  bullets: string[];
  recommendation: string;
}

/** Compute percent delta (b relative to a). Positive = b is larger. */
export function percentDelta(a: number, b: number): number {
  if (a === 0) return 0;
  return ((b - a) / a) * 100;
}

/** Format a percent delta with sign and 1 decimal. */
export function formatDelta(pct: number, invert = false): string {
  // invert=true means "positive delta is bad" (e.g. perplexity going up).
  // In that case we color the bad direction red.
  const fixed = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  if (Math.abs(pct) < 0.5) return chalk.gray(fixed);
  const isGood = invert ? pct < 0 : pct > 0;
  return isGood ? chalk.green(fixed) : chalk.red(fixed);
}

/**
 * Take raw measurements and produce a human verdict.
 *
 * Thresholds:
 *   - perplexity delta <3%: excellent (negligible quality loss)
 *   - perplexity delta 3-8%: good (expected for typical quants)
 *   - perplexity delta 8-15%: acceptable (aggressive quants)
 *   - perplexity delta >15%: risky (quality visibly degraded)
 *   - any prompt diverged >30% of battery: downgrade one level
 *
 * If perplexity is unavailable (binary missing, etc.) we base the
 * verdict on prompt battery + size alone.
 */
export function assessReport(report: BenchmarkReport): Assessment {
  const bullets: string[] = [];
  let verdict: Assessment["verdict"] = "good";

  // Size delta (always measurable)
  const sizeDelta = percentDelta(report.originalSizeGb, report.compressedSizeGb);
  if (sizeDelta < -10) {
    bullets.push(`Size reduced by ${Math.abs(sizeDelta).toFixed(0)}%`);
  }

  // Perplexity delta
  let pplDelta: number | null = null;
  if (report.originalPerplexity && report.compressedPerplexity) {
    pplDelta = percentDelta(
      report.originalPerplexity.perplexity,
      report.compressedPerplexity.perplexity,
    );
    if (pplDelta < 3) {
      bullets.push(
        `Perplexity delta of ${pplDelta.toFixed(1)}% is negligible — quality essentially preserved`,
      );
      verdict = "excellent";
    } else if (pplDelta < 8) {
      bullets.push(
        `Perplexity degraded ${pplDelta.toFixed(1)}% — within expected range for this quant level`,
      );
      verdict = "good";
    } else if (pplDelta < 15) {
      bullets.push(
        `Perplexity degraded ${pplDelta.toFixed(1)}% — aggressive compression, some quality loss expected`,
      );
      verdict = "acceptable";
    } else {
      bullets.push(
        `Perplexity degraded ${pplDelta.toFixed(1)}% — quality noticeably reduced`,
      );
      verdict = "risky";
    }
  }

  // Speed delta
  if (report.originalBench && report.compressedBench) {
    const genDelta = percentDelta(
      report.originalBench.generationTokensPerSec,
      report.compressedBench.generationTokensPerSec,
    );
    if (genDelta > 5) {
      bullets.push(`Generation speed ${genDelta > 0 ? "up" : "down"} ${Math.abs(genDelta).toFixed(0)}%`);
    }
  }

  // Prompt battery — downgrade verdict if meaningful divergences
  if (report.battery) {
    const divergedPct = (report.battery.diverged / report.battery.total) * 100;
    if (divergedPct === 0) {
      bullets.push(`Prompt battery: ${report.battery.matching}/${report.battery.total} responses match`);
    } else if (divergedPct <= 20) {
      bullets.push(
        `Prompt battery: ${report.battery.matching}/${report.battery.total} responses match — minor divergence`,
      );
    } else if (divergedPct <= 40) {
      bullets.push(
        `Prompt battery: ${report.battery.matching}/${report.battery.total} responses match — some regressions`,
      );
      if (verdict === "excellent") verdict = "good";
      if (verdict === "good") verdict = "acceptable";
    } else {
      bullets.push(
        `Prompt battery: ${report.battery.matching}/${report.battery.total} responses match — significant regressions`,
      );
      verdict = "risky";
    }
  }

  const headlines: Record<Assessment["verdict"], string> = {
    excellent: "Excellent — ship it confidently",
    good: "Good — typical quantization trade-off",
    acceptable: "Acceptable — verify important use cases",
    risky: "Risky — quality loss may affect real use",
  };

  const recommendations: Record<Assessment["verdict"], string> = {
    excellent:
      "The compressed model is essentially indistinguishable from the original. Ship it.",
    good: "Normal quality/size trade-off. Ship it unless your workload is quality-critical.",
    acceptable:
      "Aggressive compression. Test on your actual workload before committing. Consider a larger quant (e.g. Q4_K_M → Q5_K_M) if quality matters.",
    risky:
      "Quality loss is visible in measurements. Strongly consider a less aggressive quant or use --from-source to re-quantize from original weights.",
  };

  return {
    verdict,
    headline: headlines[verdict],
    bullets,
    recommendation: recommendations[verdict],
  };
}

function pad(s: string, width: number): string {
  // chalk wraps the string with ANSI codes — these don't contribute to
  // visible width, so strip them before padding.
  // eslint-disable-next-line no-control-regex
  const visible = s.replace(/\u001b\[[0-9;]*m/g, "");
  const deficit = width - visible.length;
  return deficit > 0 ? s + " ".repeat(deficit) : s;
}

/**
 * Render the full report as a table printed to stdout. Zero-side-
 * effect version is assessReport() above — this function assumes you
 * want to print something.
 */
export function printBenchmarkReport(report: BenchmarkReport): void {
  console.log();
  console.log(
    chalk.bold.cyan(
      `  CompressX Benchmark: ${report.originalLabel}  vs  ${report.compressedLabel}`,
    ),
  );
  console.log(chalk.gray(`  ${"-".repeat(60)}`));

  const rows: string[][] = [];
  rows.push(["", chalk.bold("Original"), chalk.bold("Compressed"), chalk.bold("Delta")]);

  // Size
  rows.push([
    "Size on disk",
    `${report.originalSizeGb.toFixed(2)} GB`,
    `${report.compressedSizeGb.toFixed(2)} GB`,
    formatDelta(percentDelta(report.originalSizeGb, report.compressedSizeGb)),
  ]);

  // Speed (if we got bench data)
  if (report.originalBench && report.compressedBench) {
    rows.push([
      "Prompt eval",
      `${report.originalBench.promptEvalTokensPerSec.toFixed(1)} tok/s`,
      `${report.compressedBench.promptEvalTokensPerSec.toFixed(1)} tok/s`,
      formatDelta(
        percentDelta(
          report.originalBench.promptEvalTokensPerSec,
          report.compressedBench.promptEvalTokensPerSec,
        ),
      ),
    ]);
    rows.push([
      "Generation",
      `${report.originalBench.generationTokensPerSec.toFixed(1)} tok/s`,
      `${report.compressedBench.generationTokensPerSec.toFixed(1)} tok/s`,
      formatDelta(
        percentDelta(
          report.originalBench.generationTokensPerSec,
          report.compressedBench.generationTokensPerSec,
        ),
      ),
    ]);
  }

  // Perplexity (lower is better, so invert the delta coloring)
  if (report.originalPerplexity && report.compressedPerplexity) {
    rows.push([
      "Perplexity",
      report.originalPerplexity.perplexity.toFixed(3),
      report.compressedPerplexity.perplexity.toFixed(3),
      formatDelta(
        percentDelta(
          report.originalPerplexity.perplexity,
          report.compressedPerplexity.perplexity,
        ),
        true,
      ),
    ]);
  }

  // Prompt battery
  if (report.battery) {
    rows.push([
      "Prompt battery",
      `${report.battery.total}/${report.battery.total} ok`,
      `${report.battery.matching}/${report.battery.total} ok`,
      report.battery.diverged === 0
        ? chalk.green("0 diverged")
        : chalk.yellow(`${report.battery.diverged} diverged`),
    ]);
  }

  // Compute column widths
  const widths = [0, 0, 0, 0];
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      // eslint-disable-next-line no-control-regex
      const visible = row[i].replace(/\u001b\[[0-9;]*m/g, "");
      if (visible.length > widths[i]) widths[i] = visible.length;
    }
  }

  // Print rows
  for (const row of rows) {
    const line =
      "  " +
      pad(row[0], widths[0] + 4) +
      pad(row[1], widths[1] + 4) +
      pad(row[2], widths[2] + 4) +
      row[3];
    console.log(line);
  }

  console.log();
  const assessment = assessReport(report);
  const verdictColor: Record<Assessment["verdict"], (s: string) => string> = {
    excellent: chalk.green.bold,
    good: chalk.cyan.bold,
    acceptable: chalk.yellow.bold,
    risky: chalk.red.bold,
  };
  console.log(`  Assessment: ${verdictColor[assessment.verdict](assessment.headline)}`);
  for (const bullet of assessment.bullets) {
    console.log(chalk.gray(`    • ${bullet}`));
  }
  console.log();
  console.log(chalk.bold("  Recommendation: ") + chalk.gray(assessment.recommendation));
  console.log();
}
