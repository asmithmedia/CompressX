#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CompressXClient } from "./api/client.js";
import {
  OLLAMA_MODELS,
  searchModels,
  estimateCompressedSize,
  recommendQuantForHardware,
} from "./tools/model-data.js";

const API_KEY = process.env.COMPRESSX_API_KEY || "";
const API_URL = process.env.COMPRESSX_API_URL || "https://compressx.asmith.media/api/v1";

const client = new CompressXClient(API_URL, API_KEY);

const server = new McpServer({
  name: "compressx",
  version: "0.1.0",
});

// Tool: list_models - Search available models (free)
server.tool(
  "list_models",
  "Search available LLM models that can be compressed. Returns Ollama model IDs, sizes, and descriptions.",
  {
    query: z.string().optional().describe("Search query (e.g., 'qwen', 'gemma', '7b')"),
    family: z.string().optional().describe("Filter by family (Qwen, Gemma, Llama, Mistral, Phi)"),
    maxSizeGb: z.number().optional().describe("Maximum FP16 model size in GB"),
  },
  async ({ query, family, maxSizeGb }) => {
    let models = query ? searchModels(query) : OLLAMA_MODELS;

    if (family) {
      models = models.filter((m) => m.family.toLowerCase() === family.toLowerCase());
    }
    if (maxSizeGb) {
      models = models.filter((m) => m.fp16SizeGb <= maxSizeGb);
    }

    const results = models.map((m) => ({
      ollamaId: m.ollamaId,
      name: m.name,
      parameters: `${m.parametersBillion}B`,
      fp16Size: `${m.fp16SizeGb} GB`,
      family: m.family,
      description: m.description,
    }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
    };
  }
);

// Tool: recommend_compression - Hardware-aware recommendation (free)
server.tool(
  "recommend_compression",
  "Given a model and hardware specs, recommend the best quantization level. Use this when a developer asks what compression to use.",
  {
    model: z.string().describe("Ollama model ID (e.g., 'qwen3:4b') or HuggingFace repo"),
    ramGb: z.number().optional().describe("System RAM in GB"),
    vramGb: z.number().optional().describe("GPU VRAM in GB"),
    gpuName: z.string().optional().describe("GPU name (e.g., 'RTX 3060')"),
    prioritize: z.enum(["quality", "size", "speed"]).optional().describe("What to optimize for"),
  },
  async ({ model, ramGb, vramGb, gpuName, prioritize }) => {
    const modelInfo = OLLAMA_MODELS.find(
      (m) => m.ollamaId === model || m.name.toLowerCase().includes(model.toLowerCase())
    );

    if (!modelInfo) {
      return {
        content: [{ type: "text" as const, text: `Model "${model}" not found. Use list_models to see available models.` }],
      };
    }

    const recommendations = recommendQuantForHardware(
      modelInfo.parametersBillion,
      ramGb || null,
      vramGb || null,
      prioritize || "quality"
    );

    const result = {
      model: modelInfo.name,
      ollamaId: modelInfo.ollamaId,
      originalSize: `${modelInfo.fp16SizeGb} GB (FP16)`,
      hardware: { ramGb, vramGb, gpuName },
      recommended: recommendations[0],
      alternatives: recommendations.slice(1),
      nextStep: `To compress, use the compress_model tool with model="${modelInfo.ollamaId}" and quantType="${recommendations[0].quantType}"`,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool: compress_model - Compress a model (costs credits)
server.tool(
  "compress_model",
  "Compress an LLM model to GGUF format. Requires a CompressX account with available credits. Returns a job ID to track progress.",
  {
    model: z.string().describe("Ollama model ID (e.g., 'qwen3:4b')"),
    quantType: z.string().default("q4_k_m").describe("Quantization type (q8_0, q5_k_m, q4_k_m, q3_k_m, q2_k)"),
  },
  async ({ model, quantType }) => {
    if (!API_KEY) {
      return {
        content: [{
          type: "text" as const,
          text: "No API key configured. Set COMPRESSX_API_KEY environment variable.\n\nGet your key at https://compressx.asmith.media/settings/api-keys\n\nFree tier includes 100 credits/month.",
        }],
      };
    }

    const modelInfo = OLLAMA_MODELS.find((m) => m.ollamaId === model);
    if (!modelInfo) {
      return {
        content: [{ type: "text" as const, text: `Model "${model}" not found. Use list_models to search.` }],
      };
    }

    try {
      const result = await client.compress({
        sourceModelId: modelInfo.hfRepoId,
        sourceModelName: modelInfo.name,
        method: "GGUF",
        config: { quant_type: quantType },
      });

      const estSize = estimateCompressedSize(modelInfo.parametersBillion, quantType);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "Job submitted",
            jobId: result.id,
            model: modelInfo.name,
            quantType,
            estimatedOutputSize: `${estSize} GB`,
            creditCost: Math.ceil(modelInfo.fp16SizeGb),
            checkProgress: `Use check_job_status with jobId="${result.id}"`,
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Compression failed: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  }
);

// Tool: check_job_status - Poll compression progress (free)
server.tool(
  "check_job_status",
  "Check the status and progress of a compression job.",
  {
    jobId: z.string().describe("The job ID returned by compress_model"),
  },
  async ({ jobId }) => {
    if (!API_KEY) {
      return { content: [{ type: "text" as const, text: "No API key configured." }] };
    }

    try {
      const job = await client.getJob(jobId);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(job, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  }
);

// Tool: get_credits - Check account balance (free)
server.tool(
  "get_credits",
  "Check your CompressX credit balance and tier information.",
  {},
  async () => {
    if (!API_KEY) {
      return {
        content: [{
          type: "text" as const,
          text: "No API key configured. Set COMPRESSX_API_KEY to check credits.\n\nSign up free at https://compressx.asmith.media",
        }],
      };
    }

    try {
      const credits = await client.getCredits();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(credits, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
