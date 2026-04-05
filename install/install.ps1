# CompressX one-line installer for Windows
# Usage: powershell -c "irm https://compressx.asmith.media/install.ps1 | iex"

$ErrorActionPreference = "Stop"

# Try to enable UTF-8 output, but fall back silently on older hosts
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Write-Host ""
Write-Host "  CompressX" -ForegroundColor Cyan -NoNewline
Write-Host " - LLM compression for Ollama"
Write-Host "  ====================================="
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node -v
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -lt 18) {
        Write-Host "  [X] Node.js 18+ required. Found: $nodeVersion" -ForegroundColor Red
        exit 1
    }
    Write-Host "  [OK]" -ForegroundColor Green -NoNewline
    Write-Host " Node.js $nodeVersion"
} catch {
    Write-Host "  [X] Node.js is required but not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Install Node.js from https://nodejs.org (v18 or later)"
    Write-Host ""
    exit 1
}

# Check Python
try {
    python --version | Out-Null
    Write-Host "  [OK]" -ForegroundColor Green -NoNewline
    Write-Host " Python installed"
} catch {
    Write-Host "  [!] Python 3 not found. Required for model conversion." -ForegroundColor Yellow
    Write-Host "      Install from https://python.org"
}

# Check Ollama
try {
    ollama --version | Out-Null
    Write-Host "  [OK]" -ForegroundColor Green -NoNewline
    Write-Host " Ollama installed"
} catch {
    Write-Host "  [!] Ollama not found. Install from https://ollama.com" -ForegroundColor Yellow
}

# Install CompressX CLI
Write-Host ""
Write-Host "  Installing CompressX..." -ForegroundColor White
npm install -g compressx

# Set up tools directory
$compressxDir = "$env:USERPROFILE\.compressx"
$binDir = "$compressxDir\bin"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

# Download convert_hf_to_gguf.py
$convertScript = "$binDir\convert_hf_to_gguf.py"
if (-not (Test-Path $convertScript)) {
    Write-Host "  Downloading llama.cpp conversion script..."
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/ggerganov/llama.cpp/master/convert_hf_to_gguf.py" -OutFile $convertScript -UseBasicParsing
}

# Install Python dependencies
try {
    Write-Host "  Installing Python dependencies..."
    pip install --quiet --user huggingface_hub gguf sentencepiece protobuf 2>&1 | Out-Null
} catch {
    Write-Host "  [!] Could not install Python packages automatically" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  [OK] CompressX installed!" -ForegroundColor Green
Write-Host ""
Write-Host "  Quick start:"
Write-Host "    compressx" -ForegroundColor Cyan -NoNewline
Write-Host "                    # Scan your Ollama library, suggest compressions"
Write-Host "    compressx compress qwen3:4b" -ForegroundColor Cyan -NoNewline
Write-Host "  # Compress a specific model"
Write-Host "    compressx hardware" -ForegroundColor Cyan -NoNewline
Write-Host "            # Show detected hardware"
Write-Host ""
Write-Host "  Originals are kept. Compressed versions get a " -NoNewline
Write-Host "-cx" -ForegroundColor Green -NoNewline
Write-Host " suffix in Ollama."
Write-Host "  Example: " -NoNewline
Write-Host "qwen3:4b" -ForegroundColor Cyan -NoNewline
Write-Host " -> " -NoNewline
Write-Host "qwen3:4b-cx" -ForegroundColor Green
Write-Host ""
