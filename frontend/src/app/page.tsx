import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-sm">
              CX
            </div>
            <span className="text-xl font-bold">CompressX</span>
          </div>
          <div className="flex gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-gray-300 hover:text-white transition"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition font-medium"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-block px-4 py-1 mb-6 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium">
          Now supporting GGUF quantization
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent leading-tight">
          Compress LLMs.
          <br />
          Run them anywhere.
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Shrink large language models by up to 6x without losing what makes them
          smart. Deploy on laptops, edge devices, and phones.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/register"
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-medium transition"
          >
            Start Compressing
          </Link>
          <Link
            href="#how-it-works"
            className="px-8 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-lg font-medium transition border border-gray-700"
          >
            How It Works
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold text-blue-400">6x</div>
            <div className="text-gray-500 mt-1">Compression Ratio</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-purple-400">&lt;2%</div>
            <div className="text-gray-500 mt-1">Quality Loss (Q4_K_M)</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-green-400">7</div>
            <div className="text-gray-500 mt-1">Quantization Levels</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-bold text-center mb-16">
          Three steps to a smaller model
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: "Choose Your Model",
              desc: "Search HuggingFace or upload your own. We support all transformer-based LLMs.",
            },
            {
              step: "2",
              title: "Pick Compression Level",
              desc: "From lossless FP16 to aggressive Q2_K. See estimated size and quality impact before you compress.",
            },
            {
              step: "3",
              title: "Download & Deploy",
              desc: "Get a GGUF file ready for Ollama, llama.cpp, LM Studio, or any local inference engine.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8"
            >
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold mb-4">
                {item.step}
              </div>
              <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
              <p className="text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quantization types */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-bold text-center mb-12">
          Quantization Options
        </h2>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-6 py-4 text-gray-400 font-medium">Type</th>
                <th className="px-6 py-4 text-gray-400 font-medium">Bits/Weight</th>
                <th className="px-6 py-4 text-gray-400 font-medium">Size (7B)</th>
                <th className="px-6 py-4 text-gray-400 font-medium">Quality</th>
              </tr>
            </thead>
            <tbody>
              {[
                { type: "F16", bits: "16", size: "~13 GB", quality: "Baseline" },
                { type: "Q8_0", bits: "8", size: "~7 GB", quality: "Excellent" },
                { type: "Q5_K_M", bits: "5", size: "~5 GB", quality: "Very Good" },
                { type: "Q4_K_M", bits: "4", size: "~4 GB", quality: "Good" },
                { type: "Q3_K_M", bits: "3", size: "~3 GB", quality: "Fair" },
                { type: "Q2_K", bits: "2", size: "~2.5 GB", quality: "Reduced" },
              ].map((row) => (
                <tr key={row.type} className="border-b border-gray-700/50">
                  <td className="px-6 py-3 font-mono text-blue-400">{row.type}</td>
                  <td className="px-6 py-3">{row.bits}</td>
                  <td className="px-6 py-3">{row.size}</td>
                  <td className="px-6 py-3">{row.quality}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to shrink your models?</h2>
        <p className="text-gray-400 mb-8">
          Free tier includes 3 compression jobs per month. No credit card required.
        </p>
        <Link
          href="/register"
          className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-medium transition"
        >
          Get Started Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-8">
        <div className="max-w-6xl mx-auto flex justify-between items-center text-gray-500 text-sm">
          <span>CompressX 2026</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-gray-300">Docs</a>
            <a href="#" className="hover:text-gray-300">GitHub</a>
            <a href="#" className="hover:text-gray-300">API</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
