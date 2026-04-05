# CompressX

**Compress LLMs. Keep the originals.**

One command to shrink every model in your Ollama library. Originals stay intact — compressed versions get a `-cx` suffix.

```bash
npm install -g compressx
```

## Quick Start

```bash
# Scan your Ollama library and suggest compressions
compressx

# Compress a specific model to the auto-recommended quant level
compressx compress qwen3:4b

# Show your hardware
compressx hardware
```

After compression:

```bash
ollama list
#   qwen3:4b      5.2 GB   ← your original (untouched)
#   qwen3:4b-cx   2.4 GB   ← new, compressed by CompressX

ollama run qwen3:4b-cx
```

## How It Works

1. **Scan.** `compressx` detects your GPU and RAM, queries your local Ollama, and identifies models that could be smaller.
2. **Compress.** Downloads the original unquantized weights from HuggingFace, runs GGUF quantization locally via `llama.cpp`. No cloud. No uploads. No account.
3. **Register.** The compressed model is auto-registered in Ollama with a `:tag-cx` suffix. Your originals are never modified.

## Why CompressX?

- **Originals stay intact** — compressed versions live alongside them with a clear `-cx` suffix.
- **Fully local** — uses your own GPU. No data leaves your machine.
- **Hardware-aware** — auto-detects VRAM and picks the right quantization level.
- **Free forever** — no account, no credits, no rate limits.

## Commands

| Command | Description |
|---|---|
| `compressx` | Scan Ollama library and interactively compress models |
| `compressx compress <model>` | Compress a specific model with auto-recommended quant |
| `compressx compress <model> -q q4_k_m` | Compress with a specific quantization type |
| `compressx hardware` | Show detected GPU, VRAM, RAM, and max model size |
| `compressx models` | List all supported models |
| `compressx update` | Update CompressX to the latest version |
| `compressx uninstall` | Remove CompressX data directory |

## Updating

```bash
compressx update
# or equivalently:
npm install -g compressx@latest
```

CompressX also checks for new versions automatically once per day and shows a one-line banner when an update is available. Set `COMPRESSX_NO_UPDATE_CHECK=1` in your environment to opt out.

## Uninstalling

One-line uninstaller that removes the CLI and data directory:

```bash
# macOS / Linux
curl -fsSL https://compressx.asmith.media/uninstall.sh | sh

# Windows
powershell -c "irm https://compressx.asmith.media/uninstall.ps1 | iex"
```

Or do it manually in two steps:
```bash
compressx uninstall          # removes ~/.compressx/ data
npm uninstall -g compressx   # removes the CLI binary
```

## Requirements

- **Node.js** 18 or later
- **Python** 3.11+ with `huggingface_hub` and `gguf` packages
- **llama.cpp** tools (`convert_hf_to_gguf.py` and `llama-quantize`) — the installer script downloads these automatically
- **Ollama** (optional but recommended for the full flow)
- **NVIDIA GPU** recommended for faster quantization; CPU works too

## Supported Models

Qwen 3 · Gemma 3 · Llama 3.1/3.2 · Mistral · Mixtral · Phi-4 · DeepSeek Coder · CodeGemma · TinyLlama

Run `compressx models` for the full list.

## Supported Quantization Types

| Type | Quality | Size (7B model) |
|---|---|---|
| `f16` | Baseline | ~13 GB |
| `q8_0` | Excellent | ~7 GB |
| `q6_k` | Very High | ~5.5 GB |
| `q5_k_m` | High | ~5 GB |
| `q4_k_m` | **Recommended** | ~4 GB |
| `q3_k_m` | Fair | ~3 GB |
| `q2_k` | Reduced | ~2.5 GB |

---

CompressX · an **A. Smith Labs** product · © A. Smith Media

[Visit the homepage](https://compressx.asmith.media) for the full install experience.
