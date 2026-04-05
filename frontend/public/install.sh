#!/usr/bin/env bash
# CompressX one-line installer for macOS/Linux
# Usage: curl -fsSL https://compressx.asmith.media/install.sh | sh

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}${BLUE}  CompressX${NC} - LLM compression for Ollama"
echo -e "${BOLD}  ─────────────────────────────────────${NC}"
echo ""

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}  ✗ Node.js is required but not installed.${NC}"
  echo ""
  echo "  Install Node.js from https://nodejs.org (v18 or later)"
  echo "  Or via package manager:"
  echo "    macOS:    brew install node"
  echo "    Ubuntu:   sudo apt install nodejs npm"
  echo ""
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}  ✗ Node.js 18+ required. Found: $(node -v)${NC}"
  exit 1
fi

echo -e "${GREEN}  ✓${NC} Node.js $(node -v)"

# Check Python (for llama.cpp conversion scripts)
if ! command -v python >/dev/null 2>&1 && ! command -v python3 >/dev/null 2>&1; then
  echo -e "${YELLOW}  ⚠ Python 3 not found. Required for model conversion.${NC}"
  echo "    Install Python 3.11+ from https://python.org"
fi

# Check Ollama (optional but recommended)
if command -v ollama >/dev/null 2>&1; then
  echo -e "${GREEN}  ✓${NC} Ollama installed"
else
  echo -e "${YELLOW}  ⚠${NC} Ollama not found. Install from https://ollama.com"
fi

# Install CompressX CLI via npm
echo ""
echo -e "${BOLD}  Installing CompressX...${NC}"
npm install -g compressx 2>&1 | tail -5

# Set up llama.cpp tools directory
COMPRESSX_DIR="$HOME/.compressx"
BIN_DIR="$COMPRESSX_DIR/bin"
mkdir -p "$BIN_DIR"

# Download convert_hf_to_gguf.py if not present
if [ ! -f "$BIN_DIR/convert_hf_to_gguf.py" ]; then
  echo -e "${BOLD}  Downloading llama.cpp conversion script...${NC}"
  curl -sL "https://raw.githubusercontent.com/ggerganov/llama.cpp/master/convert_hf_to_gguf.py" \
    -o "$BIN_DIR/convert_hf_to_gguf.py"
  chmod +x "$BIN_DIR/convert_hf_to_gguf.py"
fi

# Install Python dependencies for conversion
if command -v pip >/dev/null 2>&1 || command -v pip3 >/dev/null 2>&1; then
  PIP=$(command -v pip3 || command -v pip)
  echo -e "${BOLD}  Installing Python dependencies...${NC}"
  $PIP install --quiet --user huggingface_hub gguf sentencepiece protobuf 2>&1 | tail -3 || true
fi

echo ""
echo -e "${GREEN}${BOLD}  ✓ CompressX installed!${NC}"
echo ""
echo -e "${BOLD}  Quick start:${NC}"
echo -e "    ${BLUE}compressx${NC}                    ${NC}# Scan your Ollama library, suggest compressions${NC}"
echo -e "    ${BLUE}compressx compress qwen3:4b${NC}  ${NC}# Compress a specific model${NC}"
echo -e "    ${BLUE}compressx hardware${NC}            ${NC}# Show detected hardware${NC}"
echo ""
echo -e "  ${NC}Originals are kept. Compressed versions get a ${GREEN}-cx${NC} suffix in Ollama.${NC}"
echo -e "  ${NC}Example: ${BLUE}qwen3:4b${NC} → ${GREEN}qwen3:4b-cx${NC}"
echo ""
