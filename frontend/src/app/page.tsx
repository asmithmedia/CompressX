import Link from "next/link";
import { InstallTabs } from "@/components/install-tabs";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Nav */}
      <nav className="border-b border-gray-900 px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-cyan-500 rounded-md flex items-center justify-center font-bold text-black text-sm">
              cx
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-bold">CompressX</span>
              <a
                href="https://asmith.media/labs"
                className="text-[10px] text-gray-500 hover:text-gray-300 transition font-sans"
              >
                an A. Smith Labs product
              </a>
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <a href="#how-it-works" className="text-gray-400 hover:text-white transition">
              How it works
            </a>
            <a href="#docs" className="text-gray-400 hover:text-white transition">
              Docs
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="inline-block px-3 py-1 mb-6 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs">
          $ npm install -g compressx
        </div>

        <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight font-sans">
          Compress LLMs.
          <br />
          <span className="text-gray-500">Keep the originals.</span>
        </h1>

        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 font-sans">
          One command to shrink every model in your Ollama library.
          Originals stay intact — compressed versions get a{" "}
          <code className="text-green-400 bg-gray-900 px-2 py-0.5 rounded">-cx</code>{" "}
          suffix.
        </p>

        {/* Install command — OS tabs */}
        <div className="mb-8">
          <InstallTabs />
        </div>

        <div className="flex gap-3 justify-center text-sm">
          <Link
            href="#how-it-works"
            className="px-5 py-2 bg-white text-black rounded-md hover:bg-gray-200 transition font-medium"
          >
            How it works
          </Link>
          <Link
            href="#docs"
            className="px-5 py-2 border border-gray-800 rounded-md hover:border-gray-600 transition"
          >
            View commands
          </Link>
        </div>
      </section>

      {/* What's new in v0.7 */}
      <section className="max-w-4xl mx-auto px-6 pb-4 font-sans">
        <div className="bg-gray-950 border border-gray-900 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 rounded px-2 py-0.5">
              NEW · v0.7
            </span>
            <span className="text-xs text-gray-500">Benchmark release</span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="text-white font-bold mb-1">Benchmark before &amp; after</div>
              <p className="text-gray-500">
                New <code className="text-green-400">compressx benchmark</code> command. Side-by-side
                speed, perplexity, and a 10-prompt regression battery with a
                verdict.
              </p>
            </div>
            <div>
              <div className="text-white font-bold mb-1">Live progress bar</div>
              <p className="text-gray-500">
                Real-time per-tensor progress with percent and ETA while
                quantization runs. No more wondering if it hung.
              </p>
            </div>
            <div>
              <div className="text-white font-bold mb-1">Self-installing</div>
              <p className="text-gray-500">
                First run auto-downloads llama.cpp binaries. No manual setup,
                no <code className="text-green-400">brew install</code> prereqs.
              </p>
            </div>
            <div>
              <div className="text-white font-bold mb-1">Post-compression smoke test</div>
              <p className="text-gray-500">
                Every compressed model gets a sanity check. Catches broken
                quants before you ever load them.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Terminal demo */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
          <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-900 border-b border-gray-800">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <div className="flex-1 text-center text-xs text-gray-500">~/my-project</div>
          </div>
          <div className="p-6 text-sm leading-relaxed">
            <div><span className="text-gray-600">$</span> <span className="text-white">compressx</span></div>
            <div className="text-cyan-400 mt-3">  CompressX - LLM Compression for Ollama</div>
            <div className="text-gray-500 mt-2">  ✓ Ollama running with 20 models</div>
            <div className="text-gray-500">  ✓ NVIDIA RTX 5060 | 32 GB RAM | 8 GB VRAM</div>
            <div className="text-white mt-3">  Found 4 models that could be smaller:</div>
            <div className="mt-2 text-xs text-gray-600">  Model            Current    → CompressX     Savings</div>
            <div className="text-xs text-gray-600">  ──────────────────────────────────────────────────</div>
            <div className="mt-1 text-xs">
              <span className="text-white">  qwen3:14b        </span>
              <span className="text-gray-500">8.4 GB    </span>
              <span className="text-green-400">6.2 GB Q3_K_M </span>
              <span className="text-cyan-400">-26%</span>
            </div>
            <div className="text-xs">
              <span className="text-white">  gemma4:12b       </span>
              <span className="text-gray-500">9.6 GB    </span>
              <span className="text-green-400">5.8 GB Q3_K_M </span>
              <span className="text-cyan-400">-40%</span>
            </div>
            <div className="text-xs">
              <span className="text-white">  llama3.1:8b      </span>
              <span className="text-gray-500">4.9 GB    </span>
              <span className="text-green-400">3.1 GB Q4_K_M </span>
              <span className="text-cyan-400">-37%</span>
            </div>
            <div className="text-gray-400 mt-3">  ? Select models to compress: <span className="text-white">(space to toggle)</span></div>
            <div className="text-green-400">    ❯ ◉ qwen3:14b</div>
            <div className="text-green-400">      ◉ gemma4:12b</div>
            <div className="text-gray-600">      ◯ llama3.1:8b</div>
            <div className="text-white mt-3">  [1/1] Re-quantizing local blob to Q3_K_M...</div>
            <div className="mt-1 text-xs">
              <span className="text-green-400">  ████████████████</span>
              <span className="text-gray-700">░░░░░░░░░░░░  </span>
              <span className="text-white font-bold">58.2%  </span>
              <span className="text-gray-500">169/291 tensors  0:14 elapsed  eta 0:10</span>
            </div>
            <div className="text-gray-500 mt-3">  Using local Ollama blobs. <span className="text-green-400">~30 sec each, zero download.</span></div>
          </div>
        </div>
      </section>

      {/* Benchmark demo */}
      <section className="max-w-3xl mx-auto px-6 pb-20 font-sans">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Know what you&apos;re shipping.</h2>
          <p className="text-gray-500 text-sm">
            <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">
              compressx benchmark qwen3:4b
            </code>{" "}
            runs a side-by-side comparison with a color-coded verdict.
          </p>
        </div>
        <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden font-mono text-xs">
          <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-900 border-b border-gray-800">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <div className="flex-1 text-center text-gray-500">benchmark</div>
          </div>
          <div className="p-6 leading-relaxed">
            <div className="text-cyan-400">  CompressX Benchmark: qwen3:4b  vs  qwen3:4b-cx</div>
            <div className="text-gray-700">  ────────────────────────────────────────────</div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <div className="text-gray-600"></div>
              <div className="text-white font-bold">Original</div>
              <div className="text-white font-bold">Compressed</div>
              <div className="text-white font-bold">Delta</div>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-1">
              <div className="text-gray-500">Size on disk</div>
              <div className="text-gray-400">8.10 GB</div>
              <div className="text-gray-400">2.60 GB</div>
              <div className="text-green-400">-68%</div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-gray-500">Prompt eval</div>
              <div className="text-gray-400">142 tok/s</div>
              <div className="text-gray-400">187 tok/s</div>
              <div className="text-green-400">+32%</div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-gray-500">Generation</div>
              <div className="text-gray-400">48 tok/s</div>
              <div className="text-gray-400">74 tok/s</div>
              <div className="text-green-400">+54%</div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-gray-500">Perplexity</div>
              <div className="text-gray-400">7.42</div>
              <div className="text-gray-400">7.89</div>
              <div className="text-yellow-400">+6.3%</div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-gray-500">Prompt battery</div>
              <div className="text-gray-400">10/10 ok</div>
              <div className="text-gray-400">9/10 ok</div>
              <div className="text-yellow-400">1 diverged</div>
            </div>
            <div className="mt-4">
              <span className="text-gray-500">  Assessment: </span>
              <span className="text-cyan-400 font-bold">Good — typical quantization trade-off</span>
            </div>
            <div className="text-gray-600 mt-1">    • Size reduced by 68%</div>
            <div className="text-gray-600">    • Perplexity delta of 6.3% — within expected range</div>
            <div className="text-gray-600">    • Generation speed up 54%</div>
            <div className="mt-3">
              <span className="text-white font-bold">  Recommendation: </span>
              <span className="text-gray-500">Ship it unless quality-critical.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Works with */}
      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-gray-900 font-sans">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold mb-3">Works with your runtime</h2>
          <p className="text-gray-500 text-sm">
            Compress once, deploy anywhere. Choose your target with the{" "}
            <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded text-xs">
              --target
            </code>{" "}
            flag.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-950 border border-gray-900 rounded-lg p-5">
            <div className="flex items-baseline gap-2 mb-2">
              <h3 className="text-white font-bold">Ollama</h3>
              <span className="text-green-400 text-[10px] bg-green-500/10 px-2 py-0.5 rounded">
                DEFAULT
              </span>
            </div>
            <p className="text-gray-500 text-xs mb-3">
              Auto-registers as <code className="text-green-400">model:tag-cx</code>.
              No extra steps.
            </p>
            <code className="text-green-400 text-xs block bg-black border border-gray-800 rounded px-2 py-1.5">
              compressx compress qwen3:4b
            </code>
          </div>

          <div className="bg-gray-950 border border-gray-900 rounded-lg p-5">
            <h3 className="text-white font-bold mb-2">LM Studio</h3>
            <p className="text-gray-500 text-xs mb-3">
              Drops the GGUF into{" "}
              <code className="text-green-400">~/.lmstudio/models/</code> so it
              appears in My Models.
            </p>
            <code className="text-green-400 text-xs block bg-black border border-gray-800 rounded px-2 py-1.5 break-all">
              compressx compress qwen3:4b --target lmstudio
            </code>
          </div>

          <div className="bg-gray-950 border border-gray-900 rounded-lg p-5">
            <h3 className="text-white font-bold mb-2">Everything else</h3>
            <p className="text-gray-500 text-xs mb-3">
              Leaves the raw GGUF file in the output directory. Use with any
              GGUF-compatible tool.
            </p>
            <code className="text-green-400 text-xs block bg-black border border-gray-800 rounded px-2 py-1.5 break-all">
              compressx compress qwen3:4b --target gguf
            </code>
          </div>
        </div>

        <div className="text-center">
          <p className="text-gray-600 text-xs">
            Compatible with:{" "}
            <span className="text-gray-400">
              Ollama · LM Studio · llama.cpp · Jan · GPT4All · Msty ·
              text-generation-webui · koboldcpp
            </span>
          </p>
        </div>
      </section>

      {/* Value props */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-20 border-t border-gray-900 font-sans">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <div className="text-green-400 text-3xl mb-3">1.</div>
            <h3 className="text-lg font-bold mb-2">Scan</h3>
            <p className="text-gray-400 text-sm">
              Run <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded">compressx</code>.
              It connects to your local Ollama and auto-detects your GPU/RAM to
              find models that could be smaller.
            </p>
          </div>
          <div>
            <div className="text-green-400 text-3xl mb-3">2.</div>
            <h3 className="text-lg font-bold mb-2">Compress</h3>
            <p className="text-gray-400 text-sm">
              CompressX re-quantizes the GGUF file already in your Ollama
              library —{" "}
              <span className="text-green-400">~30 seconds, zero download</span>.
              No model yet? It falls back to fetching the original weights
              automatically. Use{" "}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded">--from-source</code>{" "}
              for pristine quality.
            </p>
          </div>
          <div>
            <div className="text-green-400 text-3xl mb-3">3.</div>
            <h3 className="text-lg font-bold mb-2">Deploy</h3>
            <p className="text-gray-400 text-sm">
              Auto-registers in Ollama (default), LM Studio, or leaves a
              raw GGUF file for llama.cpp, Jan, GPT4All, and friends. Pick
              with{" "}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded">--target</code>.
              Originals are never touched.
            </p>
          </div>
        </div>
      </section>

      {/* Why section */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-t border-gray-900 font-sans">
        <h2 className="text-3xl font-bold mb-10 text-center">
          Why CompressX?
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-950 border border-gray-900 rounded-lg p-6">
            <h3 className="text-white font-bold mb-2">Originals stay intact</h3>
            <p className="text-gray-400 text-sm">
              We never modify your existing models. Compressed versions live
              alongside them with a clear <code className="text-green-400">-cx</code> suffix.
            </p>
          </div>
          <div className="bg-gray-950 border border-gray-900 rounded-lg p-6">
            <h3 className="text-white font-bold mb-2">Fully local</h3>
            <p className="text-gray-400 text-sm">
              Uses your own GPU. No upload, no cloud processing, no data leaving
              your machine. Privacy by design.
            </p>
          </div>
          <div className="bg-gray-950 border border-gray-900 rounded-lg p-6">
            <h3 className="text-white font-bold mb-2">Hardware-aware</h3>
            <p className="text-gray-400 text-sm">
              Auto-detects your VRAM and picks the right quantization level.
              No guessing, no OOM errors.
            </p>
          </div>
          <div className="bg-gray-950 border border-gray-900 rounded-lg p-6">
            <h3 className="text-white font-bold mb-2">Free forever</h3>
            <p className="text-gray-400 text-sm">
              The CLI is open source and free. No account required. No credits.
              No rate limits on local compression.
            </p>
          </div>
        </div>
      </section>

      {/* Docs/Commands */}
      <section id="docs" className="max-w-4xl mx-auto px-6 py-20 border-t border-gray-900">
        <h2 className="text-3xl font-bold mb-10 text-center font-sans">Commands</h2>
        <div className="space-y-4">
          {[
            { cmd: "compressx", desc: "Scan Ollama library and interactively compress models" },
            { cmd: "compressx --all", desc: "Show every installed model, even ones that already fit your hardware" },
            { cmd: "compressx --preview", desc: "Library-wide preview: what compression would save for every installed model (read-only)" },
            { cmd: "compressx preview qwen3:14b", desc: "See every quant level side-by-side for a specific model" },
            { cmd: "compressx compress qwen3:4b", desc: "Compress a specific model to the auto-recommended quant level" },
            { cmd: "compressx compress qwen3:4b -q q4_k_m", desc: "Compress with a specific quantization type" },
            { cmd: "compressx compress qwen3:4b --from-source", desc: "Download original weights from HuggingFace for pristine quality (slower)" },
            { cmd: "compressx compress qwen3:4b --target lmstudio", desc: "Deploy to LM Studio instead of Ollama" },
            { cmd: "compressx compress qwen3:4b --target gguf", desc: "Just produce a GGUF file (for llama.cpp, Jan, GPT4All, Msty, etc.)" },
            { cmd: "compressx compress qwen3:4b --benchmark", desc: "Compress and immediately run a side-by-side benchmark" },
            { cmd: "compressx benchmark qwen3:4b", desc: "Full benchmark: speed, perplexity, 10-prompt battery, verdict (2-3 min)" },
            { cmd: "compressx benchmark qwen3:4b --fast", desc: "Benchmark without perplexity — speed + prompts only (~30 sec)" },
            { cmd: "compressx hardware", desc: "Show detected GPU, VRAM, RAM, and recommended model sizes" },
            { cmd: "compressx models", desc: "List all supported models" },
            { cmd: "compressx update", desc: "Update CompressX to the latest version" },
            { cmd: "compressx uninstall", desc: "Remove CompressX data directory (CLI removal is one more step)" },
          ].map((item) => (
            <div key={item.cmd} className="bg-gray-950 border border-gray-900 rounded-lg px-5 py-4">
              <code className="text-green-400 text-sm">$ {item.cmd}</code>
              <p className="text-gray-500 text-sm mt-1 font-sans">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Updates & Uninstall */}
      <section id="updates" className="max-w-4xl mx-auto px-6 py-20 border-t border-gray-900 font-sans">
        <h2 className="text-3xl font-bold mb-3 text-center">Updates & Uninstall</h2>
        <p className="text-gray-500 text-sm text-center mb-10">
          CompressX checks for updates automatically once per day. You can also
          manage it manually.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Update */}
          <div className="bg-gray-950 border border-gray-900 rounded-lg p-6">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <span className="text-green-400 text-sm">▲</span> Update
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Get the latest version with new models, bug fixes, and features.
            </p>
            <div className="space-y-2">
              <div className="bg-black border border-gray-800 rounded px-3 py-2">
                <code className="text-green-400 text-xs">$ compressx update</code>
              </div>
              <div className="bg-black border border-gray-800 rounded px-3 py-2">
                <code className="text-green-400 text-xs">$ npm install -g compressx@latest</code>
              </div>
            </div>
            <p className="text-gray-600 text-xs mt-3">
              Either command works — the first is a shortcut for the second.
            </p>
          </div>

          {/* Uninstall */}
          <div className="bg-gray-950 border border-gray-900 rounded-lg p-6">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <span className="text-red-400 text-sm">×</span> Uninstall
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Fully remove CompressX, the CLI binary, and its data directory
              (<code className="text-gray-300">~/.compressx/</code>).
            </p>
            <div className="space-y-2">
              <div className="bg-black border border-gray-800 rounded px-3 py-2">
                <code className="text-green-400 text-xs break-all">
                  $ curl -fsSL https://compressx.asmith.media/uninstall.sh | sh
                </code>
              </div>
              <div className="bg-black border border-gray-800 rounded px-3 py-2">
                <code className="text-green-400 text-xs break-all">
                  {`$ powershell -c "irm https://compressx.asmith.media/uninstall.ps1 | iex"`}
                </code>
              </div>
            </div>
            <p className="text-gray-600 text-xs mt-3">
              Top line: macOS/Linux. Bottom line: Windows.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-6 py-24 text-center font-sans border-t border-gray-900">
        <h2 className="text-3xl font-bold mb-8">Shrink your models in 30 seconds.</h2>
        <InstallTabs />
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-900 px-6 py-8 font-sans">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3 text-gray-600 text-xs">
          <div className="flex items-center gap-2">
            <span>CompressX</span>
            <span className="text-gray-700">·</span>
            <span>an</span>
            <a
              href="https://asmith.media/labs"
              className="text-gray-500 hover:text-gray-300 transition"
            >
              A. Smith Labs
            </a>
            <span>product</span>
            <span className="text-gray-700">·</span>
            <span>
              ©{" "}
              <a
                href="https://asmith.media"
                className="text-gray-500 hover:text-gray-300 transition"
              >
                A. Smith Media
              </a>
            </span>
          </div>
          <div className="flex gap-5">
            <a href="#how-it-works" className="hover:text-gray-300">
              How it works
            </a>
            <a href="#docs" className="hover:text-gray-300">
              Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
