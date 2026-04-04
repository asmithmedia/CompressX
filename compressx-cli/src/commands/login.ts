import chalk from "chalk";
import { createInterface } from "readline/promises";
import { homedir } from "os";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

export async function loginCommand() {
  console.log(chalk.bold("\n  CompressX Login\n"));
  console.log(chalk.gray("  Get your API key from https://compressx.dev/settings/api-keys\n"));

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const apiKey = await rl.question("  API Key (cx_...): ");
  rl.close();

  if (!apiKey.startsWith("cx_")) {
    console.log(chalk.red("\n  Invalid API key format. Keys start with 'cx_'"));
    process.exit(1);
  }

  // Save credentials
  const configDir = join(homedir(), ".compressx");
  mkdirSync(configDir, { recursive: true });
  writeFileSync(
    join(configDir, "credentials.json"),
    JSON.stringify({ apiKey, savedAt: new Date().toISOString() }, null, 2)
  );

  console.log(chalk.green("\n  Logged in successfully!"));
  console.log(chalk.gray("  Credentials saved to ~/.compressx/credentials.json"));
  console.log(chalk.gray("  You can now use --cloud flag for cloud compression.\n"));
}
