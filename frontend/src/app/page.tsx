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
          </div>
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
              CompressX pulls the original unquantized weights from HuggingFace
              and runs GGUF quantization locally using llama.cpp. No cloud, no
              credits, no account.
            </p>
          </div>
          <div>
            <div className="text-green-400 text-3xl mb-3">3.</div>
            <h3 className="text-lg font-bold mb-2">Run</h3>
            <p className="text-gray-400 text-sm">
              The compressed model is auto-registered in Ollama with a{" "}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded">-cx</code>{" "}
              suffix. Originals are untouched. Run with{" "}
              <code className="text-green-400 bg-gray-900 px-1.5 py-0.5 rounded">ollama run qwen3:4b-cx</code>.
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
            { cmd: "compressx compress qwen3:4b", desc: "Compress a specific model to the auto-recommended quant level" },
            { cmd: "compressx compress qwen3:4b -q q4_k_m", desc: "Compress with a specific quantization type" },
            { cmd: "compressx hardware", desc: "Show detected GPU, VRAM, RAM, and recommended model sizes" },
            { cmd: "compressx models", desc: "List all supported models" },
          ].map((item) => (
            <div key={item.cmd} className="bg-gray-950 border border-gray-900 rounded-lg px-5 py-4">
              <code className="text-green-400 text-sm">$ {item.cmd}</code>
              <p className="text-gray-500 text-sm mt-1 font-sans">{item.desc}</p>
            </div>
          ))}
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
