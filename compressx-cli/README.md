# CompressX

**Compress LLMs. Keep the originals. Deploy anywhere.**

One command to shrink LLM models for any GGUF-compatible runtime — Ollama, LM Studio, llama.cpp, Jan, GPT4All, Msty, text-generation-webui, and more. Originals stay intact — compressed versions get a `-cx` suffix.

```bash
npm install -g compressx
```

## Quick Start

```bash
# Scan your Ollama library and suggest compressions
compressx

# Preview all quant levels for any model without compressing
compressx preview qwen3:14b

# Compress a specific model to the auto-recommended quant level
compressx compress qwen3:4b

# Deploy to LM Studio instead of Ollama
compressx compress qwen3:4b --target lmstudio

# Just produce a GGUF file (for llama.cpp, Jan, GPT4All, Msty, etc.)
compressx compress qwen3:4b --target gguf

# Show your hardware
compressx hardware
```

After compression (Ollama, default target):

```bash
ollama list
#   qwen3:4b      5.2 GB   ← your original (untouched)
#   qwen3:4b-cx   2.4 GB   ← new, compressed by CompressX

ollama run qwen3:4b-cx
```

## Deployment Targets

Compress once, deploy anywhere. Choose your target with `--target`:

| Target | Where it puts the GGUF | Use for |
|---|---|---|
| `ollama` *(default)* | Registered as `<name>-cx` in your Ollama library | Ollama users |
| `lmstudio` | `~/.lmstudio/models/<Publisher>/<Repo>/<file>.gguf` | LM Studio users |
| `gguf` | Left in the `--output` directory | llama.cpp, Jan, GPT4All, Msty, text-gen-webui, koboldcpp, anyone else |

## How It Works

1. **Scan.** `compressx` detects your GPU and RAM, queries your local Ollama, and identifies models that could be smaller. On well-equipped machines, run `compressx --all` to see every installed model anyway.
2. **Preview.** Run `compressx preview <model>` to see every quant level side-by-side with estimated size, compression ratio, and VRAM fit — no download, no compression.
3. **Compress.** By default, CompressX uses the GGUF file already in your Ollama library and re-quantizes it locally — **zero download, ~30 seconds for a 4B model**. If the model isn't installed locally (or you want pristine FP16 source quality), CompressX automatically falls back to downloading the original weights from HuggingFace. Pass `--from-source` to force the fresh-download path.
4. **Deploy.** Hands the compressed file to your chosen runtime. Originals are never modified — compressed variants live alongside them with a `-cx` suffix.

### Local vs. Fresh-Source compression

| | Local (default) | `--from-source` |
|---|---|---|
| Speed | ~30 sec | ~3-10 min |
| Downloads | 0 bytes | Full model weights (~8-60 GB) |
| Quality | 1-3% more perplexity loss from double-quantization | Pristine, one-step quantization |
| Requires | Model already in Ollama | Python + `huggingface_hub` |
| Can upgrade quality? | No (can't go Q4 → Q8) | Yes |
| Best for | Shrinking models you already have | First-time compression, pristine quality |

The local path works by inheriting the source model's Modelfile (TEMPLATE, SYSTEM, PARAMETERs) so the compressed variant keeps the correct chat format. The 1-3% extra perplexity loss from double-quantization is usually imperceptible for chat and code tasks. For pristine benchmark-quality output, use `--from-source`.

## Why CompressX?

- **Originals stay intact** — compressed versions live alongside them with a clear `-cx` suffix.
- **Fully local** — uses your own GPU. No data leaves your machine.
- **Hardware-aware** — auto-detects VRAM and picks the right quantization level.
- **Free forever** — no account, no credits, no rate limits.

## Commands

| Command | Description |
|---|---|
| `compressx` | Scan Ollama library and interactively compress models |
| `compressx --all` | Show all installed models, including ones that already fit your hardware |
| `compressx preview <model>` | Preview every quant level for a model without compressing |
| `compressx compress <model>` | Compress a specific model with auto-recommended quant |
| `compressx compress <model> -q q4_k_m` | Compress with a specific quantization type |
| `compressx compress <model> --from-source` | Download original weights from HuggingFace for pristine quality |
| `compressx compress <model> --target lmstudio` | Deploy to LM Studio instead of Ollama |
| `compressx compress <model> --target gguf` | Produce a plain GGUF file (any runtime) |
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
