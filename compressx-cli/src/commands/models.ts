import chalk from "chalk";

// Inline the model data to avoid cross-package dependency issues with npx
const OLLAMA_MODELS = [
  { ollamaId: "qwen3:0.6b", name: "Qwen 3 0.6B", parametersBillion: 0.6, fp16SizeGb: 1.2, family: "Qwen", description: "Ultra-lightweight, great for edge devices", featured: false },
  { ollamaId: "qwen3:1.7b", name: "Qwen 3 1.7B", parametersBillion: 1.7, fp16SizeGb: 3.4, family: "Qwen", description: "Compact model, good for basic tasks", featured: false },
  { ollamaId: "qwen3:4b", name: "Qwen 3 4B", parametersBillion: 4, fp16SizeGb: 8, family: "Qwen", description: "Great balance of speed and capability", featured: true },
  { ollamaId: "qwen3:8b", name: "Qwen 3 8B", parametersBillion: 8, fp16SizeGb: 16, family: "Qwen", description: "Strong general-purpose model", featured: true },
  { ollamaId: "qwen3:14b", name: "Qwen 3 14B", parametersBillion: 14, fp16SizeGb: 28, family: "Qwen", description: "High-quality reasoning and coding", featured: false },
  { ollamaId: "qwen3:32b", name: "Qwen 3 32B", parametersBillion: 32, fp16SizeGb: 64, family: "Qwen", description: "Near-frontier performance", featured: false },
  { ollamaId: "gemma3:4b", name: "Gemma 3 4B", parametersBillion: 4, fp16SizeGb: 8, family: "Gemma", description: "Google's efficient 4B model", featured: true },
  { ollamaId: "gemma3:12b", name: "Gemma 3 12B", parametersBillion: 12, fp16SizeGb: 24, family: "Gemma", description: "Strong reasoning from Google", featured: false },
  { ollamaId: "llama3.2:3b", name: "Llama 3.2 3B", parametersBillion: 3, fp16SizeGb: 6.4, family: "Llama", description: "Compact, versatile Llama model", featured: true },
  { ollamaId: "llama3.1:8b", name: "Llama 3.1 8B", parametersBillion: 8, fp16SizeGb: 16, family: "Llama", description: "Popular general-purpose model", featured: true },
  { ollamaId: "llama3.1:70b", name: "Llama 3.1 70B", parametersBillion: 70, fp16SizeGb: 140, family: "Llama", description: "Frontier-class open model", featured: false },
  { ollamaId: "mistral:7b", name: "Mistral 7B", parametersBillion: 7, fp16SizeGb: 14.5, family: "Mistral", description: "Fast, efficient European model", featured: true },
  { ollamaId: "phi4:14b", name: "Phi-4 14B", parametersBillion: 14, fp16SizeGb: 28, family: "Phi", description: "Microsoft's reasoning-focused model", featured: true },
  { ollamaId: "tinyllama:1.1b", name: "TinyLlama 1.1B", parametersBillion: 1.1, fp16SizeGb: 2.2, family: "Llama", description: "Perfect for testing", featured: false },
];

interface ModelsOptions {
  family?: string;
  featured?: boolean;
}

export async function modelsCommand(query: string | undefined, options: ModelsOptions) {
  let models = OLLAMA_MODELS;

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
        m.family.toLowerCase().includes(q)
    );
  }

  if (models.length === 0) {
    console.log(chalk.yellow("No models found matching your criteria."));
    return;
  }

  console.log(chalk.bold(`\n  Available Models (${models.length})\n`));

  // Group by family
  const families = [...new Set(models.map((m) => m.family))];
  for (const family of families) {
    console.log(chalk.cyan.bold(`  ${family}`));
    const familyModels = models.filter((m) => m.family === family);
    for (const m of familyModels) {
      const star = m.featured ? chalk.yellow(" *") : "";
      console.log(
        `    ${chalk.white(m.ollamaId.padEnd(22))} ${chalk.gray(m.parametersBillion + "B").padEnd(12)} ${chalk.gray("~" + m.fp16SizeGb + " GB")}  ${chalk.gray(m.description)}${star}`
      );
    }
    console.log();
  }

  console.log(chalk.gray("  * = featured    Use: compressx compress <model-id>\n"));
}
