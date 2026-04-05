import { createInterface } from "node:readline/promises";
import { existsSync, rmSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import chalk from "chalk";

function dirSizeMb(dir: string): number {
  try {
    let total = 0;
    const walk = (path: string) => {
      const entries = statSync(path);
      if (entries.isFile()) {
        total += entries.size;
      } else if (entries.isDirectory()) {
        const { readdirSync } = require("node:fs");
        for (const name of readdirSync(path)) {
          walk(join(path, name));
        }
      }
    };
    walk(dir);
    return Math.round(total / 1024 / 1024);
  } catch {
    return 0;
  }
}

export async function uninstallCommand() {
  const compressxDir = join(homedir(), ".compressx");
  const exists = existsSync(compressxDir);
  const sizeMb = exists ? dirSizeMb(compressxDir) : 0;

  console.log(chalk.bold.cyan("\n  CompressX Uninstall"));
  console.log(chalk.gray("  " + "-".repeat(50)));
  console.log();

  if (exists) {
    console.log(`  CompressX data directory:  ${chalk.white(compressxDir)}`);
    console.log(`  Size on disk:              ${chalk.white(sizeMb + " MB")}`);
    console.log();
    console.log(chalk.gray("  This will remove:"));
    console.log(chalk.gray("    - llama.cpp binaries (CUDA runtime, quantize tool)"));
    console.log(chalk.gray("    - convert_hf_to_gguf.py script"));
    console.log(chalk.gray("    - cached credentials and config"));
    console.log();
  } else {
    console.log(chalk.gray("  No CompressX data directory found."));
    console.log();
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(chalk.yellow("  Continue with uninstall? [y/N] "))).trim().toLowerCase();
  rl.close();

  if (answer !== "y" && answer !== "yes") {
    console.log(chalk.gray("\n  Uninstall cancelled.\n"));
    return;
  }

  if (exists) {
    try {
      rmSync(compressxDir, { recursive: true, force: true });
      console.log(chalk.green(`\n  [OK] Removed ${compressxDir}`));
    } catch (err) {
      console.log(chalk.red(`\n  [X] Failed to remove ${compressxDir}`));
      console.log(chalk.gray(`      ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  console.log();
  console.log(chalk.bold("  One more step to remove the CLI itself:"));
  console.log();

  const isWindows = platform() === "win32";
  if (isWindows) {
    console.log(chalk.cyan("    npm uninstall -g compressx"));
  } else {
    console.log(chalk.cyan("    npm uninstall -g compressx"));
  }

  console.log();
  console.log(chalk.gray("  (A running process cannot delete its own binary,"));
  console.log(chalk.gray("   so this step has to be done separately.)"));
  console.log();
  console.log(chalk.gray("  Or use the one-line uninstaller that does both steps:"));
  if (isWindows) {
    console.log(chalk.cyan(`    powershell -c "irm https://compressx.asmith.media/uninstall.ps1 | iex"`));
  } else {
    console.log(chalk.cyan("    curl -fsSL https://compressx.asmith.media/uninstall.sh | sh"));
  }
  console.log();
}
