"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QUANT_TYPES, COMPRESSION_METHODS } from "@/lib/constants";

interface HFModel {
  id: string;
  author: string;
  downloads: number;
  likes: number;
  pipeline_tag: string;
  tags: string[];
}

export default function CompressPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1: Model selection
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HFModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<HFModel | null>(null);
  const [searching, setSearching] = useState(false);

  // Step 2: Method
  const [method, setMethod] = useState("GGUF");

  // Step 3: Config
  const [quantType, setQuantType] = useState("q4_k_m");

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const searchModels = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/huggingface/search?q=${encodeURIComponent(query)}`
      );
      if (res.ok) {
        setSearchResults(await res.json());
      }
    } catch {
      // ignore
    }
    setSearching(false);
  }, []);

  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => searchModels(value), 400));
  }

  async function handleSubmit() {
    if (!selectedModel) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "HUGGINGFACE",
          sourceModelId: selectedModel.id,
          sourceModelName: selectedModel.id,
          method,
          config: { quant_type: quantType },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create job");
      }

      const job = await res.json();
      router.push(`/compress/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  const selectedQuant = QUANT_TYPES.find((q) => q.value === quantType);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Compress a Model</h1>
      <p className="text-gray-400 mb-8">
        Select a model, choose compression settings, and get a smaller model file.
      </p>

      {/* Progress steps */}
      <div className="flex gap-2 mb-8">
        {["Select Model", "Method", "Configure", "Review"].map((label, i) => (
          <button
            key={label}
            onClick={() => {
              if (i + 1 < step) setStep(i + 1);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              i + 1 === step
                ? "bg-blue-600 text-white"
                : i + 1 < step
                  ? "bg-blue-600/20 text-blue-400 cursor-pointer"
                  : "bg-gray-800 text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Select Model */}
      {step === 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Search HuggingFace Models
          </h2>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search for a model (e.g., TinyLlama, Mistral, Llama)..."
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />

          {searching && (
            <div className="text-gray-400 text-sm py-4">Searching...</div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    setSelectedModel(model);
                    setStep(2);
                  }}
                  className={`w-full text-left p-4 rounded-lg border transition ${
                    selectedModel?.id === model.id
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                  }`}
                >
                  <div className="font-medium text-white">{model.id}</div>
                  <div className="text-sm text-gray-400 mt-1 flex gap-4">
                    <span>Downloads: {(model.downloads || 0).toLocaleString()}</span>
                    <span>Likes: {model.likes || 0}</span>
                    {model.pipeline_tag && <span>{model.pipeline_tag}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedModel && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition"
              >
                Next: Choose Method
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Method */}
      {step === 2 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Compression Method
          </h2>
          <div className="space-y-3">
            {COMPRESSION_METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => {
                  if (m.available) {
                    setMethod(m.value);
                    setStep(3);
                  }
                }}
                disabled={!m.available}
                className={`w-full text-left p-4 rounded-lg border transition ${
                  method === m.value && m.available
                    ? "border-blue-500 bg-blue-500/10"
                    : m.available
                      ? "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                      : "border-gray-800 bg-gray-800/30 opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="font-medium text-white">{m.label}</div>
                  {!m.available && (
                    <span className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded">
                      Coming Soon
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-400 mt-1">{m.description}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition"
            >
              Next: Configure
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Configure */}
      {step === 3 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Quantization Level
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {QUANT_TYPES.map((q) => (
              <button
                key={q.value}
                onClick={() => setQuantType(q.value)}
                className={`text-left p-4 rounded-lg border transition ${
                  quantType === q.value
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono font-medium text-white">
                    {q.label}
                  </span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <div
                        key={star}
                        className={`w-2 h-2 rounded-full ${
                          star <= q.quality ? "bg-green-400" : "bg-gray-700"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-sm text-gray-400">{q.description}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition"
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Submit */}
      {step === 4 && selectedModel && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">
            Review & Compress
          </h2>
          <div className="space-y-4 mb-6">
            <div className="flex justify-between py-3 border-b border-gray-800">
              <span className="text-gray-400">Model</span>
              <span className="text-white font-medium">{selectedModel.id}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-800">
              <span className="text-gray-400">Method</span>
              <span className="text-white font-medium">
                {COMPRESSION_METHODS.find((m) => m.value === method)?.label}
              </span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-800">
              <span className="text-gray-400">Quantization</span>
              <span className="text-white font-mono font-medium">
                {selectedQuant?.label} - {selectedQuant?.description}
              </span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-800">
              <span className="text-gray-400">Output Format</span>
              <span className="text-white font-medium">GGUF</span>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
            <p className="text-blue-400 text-sm">
              This will download the model from HuggingFace, convert it to GGUF
              format, and quantize it to {selectedQuant?.label}. The process may
              take several minutes depending on model size.
            </p>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition"
            >
              {submitting ? "Starting compression..." : "Start Compression"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
