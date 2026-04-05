# compressx-mcp

**MCP server for [CompressX](https://www.npmjs.com/package/compressx).** Lets Claude Code, Cursor, Windsurf, and other AI coding tools compress LLM models through the Model Context Protocol.

```bash
npm install -g compressx-mcp
```

## What It Does

Exposes CompressX's tools to AI assistants via MCP:

| Tool | Description |
|---|---|
| `list_models` | Search supported LLM models by name, family, or size |
| `recommend_compression` | Get hardware-aware quantization recommendations |
| `compress_model` | Kick off a compression job for a specific model |
| `check_job_status` | Poll the status of a running compression job |
| `get_credits` | Check your CompressX cloud credit balance |

## Configuration

### Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "compressx": {
      "command": "npx",
      "args": ["-y", "compressx-mcp"]
    }
  }
}
```

### Cursor / Windsurf

Add to your MCP server configuration:

```json
{
  "compressx": {
    "command": "compressx-mcp"
  }
}
```

## Usage

Once configured, just ask your AI tool:

> "I want to run Qwen3 4B on my laptop with 8 GB VRAM. What quantization should I use?"

The AI calls `recommend_compression` and gets a hardware-aware answer.

> "Compress qwen3:4b to q4_k_m for me."

The AI calls `compress_model` and tracks progress with `check_job_status`.

## Requirements

- **Node.js** 18 or later
- (Optional) A CompressX account for cloud compression. Local compression via the [compressx CLI](https://www.npmjs.com/package/compressx) does not require an account.

---

CompressX · an **A. Smith Labs** product · © A. Smith Media
