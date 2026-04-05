#!/usr/bin/env bash
# CompressX one-line uninstaller for macOS/Linux
# Usage: curl -fsSL https://compressx.asmith.media/uninstall.sh | sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}  CompressX Uninstaller${NC}"
echo -e "${BOLD}  =====================================${NC}"
echo ""

COMPRESSX_DIR="$HOME/.compressx"

# Show what will be removed
if [ -d "$COMPRESSX_DIR" ]; then
  SIZE=$(du -sh "$COMPRESSX_DIR" 2>/dev/null | cut -f1)
  echo -e "  Data directory: ${BOLD}$COMPRESSX_DIR${NC} ($SIZE)"
fi

if command -v compressx >/dev/null 2>&1; then
  CX_PATH=$(command -v compressx)
  echo -e "  CLI binary:     ${BOLD}$CX_PATH${NC}"
fi

echo ""
echo -e "${YELLOW}  This will remove CompressX and all its data.${NC}"
printf "  Continue? [y/N] "
read -r answer
if [ "$answer" != "y" ] && [ "$answer" != "Y" ] && [ "$answer" != "yes" ]; then
  echo ""
  echo "  Uninstall cancelled."
  echo ""
  exit 0
fi

echo ""

# Step 1: Uninstall the npm package
if command -v npm >/dev/null 2>&1; then
  echo -e "${BOLD}  [1/2] Removing CLI via npm...${NC}"
  npm uninstall -g compressx 2>&1 | tail -3 || true
  npm uninstall -g compressx-mcp 2>&1 | tail -3 || true
  echo -e "${GREEN}  [OK]${NC} CLI removed"
else
  echo -e "${YELLOW}  [!] npm not found. Skipping CLI removal.${NC}"
fi

echo ""

# Step 2: Remove the data directory
if [ -d "$COMPRESSX_DIR" ]; then
  echo -e "${BOLD}  [2/2] Removing data directory...${NC}"
  rm -rf "$COMPRESSX_DIR"
  echo -e "${GREEN}  [OK]${NC} Removed $COMPRESSX_DIR"
else
  echo -e "  [2/2] No data directory to remove."
fi

echo ""
echo -e "${GREEN}${BOLD}  CompressX has been fully uninstalled.${NC}"
echo -e "  ${BOLD}Thanks for trying it out.${NC}"
echo ""
