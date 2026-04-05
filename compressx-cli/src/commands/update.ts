import { spawn } from "node:child_process";
import chalk from "chalk";

export async function updateCommand() {
  console.log(chalk.bold.cyan("\n  CompressX"));
  console.log(chalk.gray("  " + "-".repeat(50)));
  console.log(chalk.gray("  Checking for the latest version..."));
  console.log();

  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["install", "-g", "compressx@latest"], {
      stdio: "inherit",
      shell: true,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        console.log();
        console.log(chalk.green.bold("  [OK] CompressX is up to date."));
        console.log(chalk.gray("  Run `compressx --version` to see the installed version.\n"));
        resolve();
      } else {
        console.log();
        console.log(chalk.red(`  Update failed (exit code ${code}).`));
        console.log(chalk.gray("  Try running manually: npm install -g compressx@latest\n"));
        reject(new Error(`npm exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      console.log(chalk.red(`  Could not run npm: ${err.message}`));
      console.log(chalk.gray("  Make sure Node.js and npm are installed.\n"));
      reject(err);
    });
  });
}
