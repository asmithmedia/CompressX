import chalk from "chalk";
import { MODEL_MAP } from "../core/model-resolver.js";

interface ModelsOptions {
  family?: string;
  featured?: boolean;
}

export async function modelsCommand(query: string | undefined, options: ModelsOptions) {
  let models = Object.values(MODEL_MAP);

  if (options.featured) {
    models = models.filter((m) => m.featured);
  }

  if (options.family) {
    const f = options.family.toLowerCase();
    models = models.filter((m) => m.family.toLowerCase() === f);
  }

  if (query) {
    const q = query.toLowerCase();
    models = models.filter(
      (m) =>
        m.ollamaId.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.family.toLowerCase().includes(q),
    );
  }

  if (models.length === 0) {
    console.log(chalk.yellow("No models found matching your criteria."));
    console.log(
      chalk.gray(
        "\nYou can still compress any model Ollama knows about — the CLI auto-detects",
      ),
    );
    console.log(
      chalk.gray(
        "size from the tag (e.g. 'compressx compress <name>:7b' works for any 7B model).",
      ),
    );
    return;
  }

  console.log(chalk.bold(`\n  Available Models (${models.length})\n`));

  // Group by family
  const families = [...new Set(models.map((m) => m.family))].sort();
  for (const family of families) {
    console.log(chalk.cyan.bold(`  ${family}`));
    const familyModels = models
      .filter((m) => m.family === family)
      .sort((a, b) => a.parametersBillion - b.parametersBillion);
    for (const m of familyModels) {
      const star = m.featured ? chalk.yellow(" *") : "";
      const params = `${m.parametersBillion}B`;
      const size = `~${m.fp16SizeGb} GB`;
      console.log(
        `    ${chalk.white(m.ollamaId.padEnd(24))} ${chalk.gray(params.padEnd(6))} ${chalk.gray(size.padEnd(10))}  ${chalk.gray(m.description)}${star}`,
      );
    }
    console.log();
  }

  console.log(chalk.gray("  * = featured    Use: compressx compress <model-id>"));
  console.log(
    chalk.gray(
      "  Tip: unknown models with size tags (e.g. gemma4:12b) work too — the CLI",
    ),
  );
  console.log(chalk.gray("       parses the size and uses the local Ollama blob automatically.\n"));
}
