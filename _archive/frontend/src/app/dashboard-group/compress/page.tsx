"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  OLLAMA_MODELS,
  searchOllamaModels,
  getFeaturedModels,
  estimateCompressedSize,
  type OllamaModel,
} from "@/lib/ollama-models";
import {
  useHardwareDetection,
  recommendQuantType,
} from "@/hooks/useHardwareDetection";

export default function CompressPage() {
  const router = useRouter();
  const hardware = useHardwareDetection();
  const [step, setStep] = useState(1);

  // Step 1: Model selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState<OllamaModel | null>(null);
  const [familyFilter, setFamilyFilter] = useState<string | null>(null);

  // Step 2: Quantization
  const [quantType, setQuantType] = useState("q4_k_m");

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Filtered models
  const displayModels = useMemo(() => {
    let models = searchQuery
      ? searchOllamaModels(searchQuery)
      : familyFilter
        ? OLLAMA_MODELS.filter((m) => m.family === familyFilter)
        : getFeaturedModels();
    return models;
  }, [searchQuery, familyFilter]);

  // Quantization recommendations
  const quantRecommendations = useMemo(() => {
    if (!selectedModel) return [];
    return recommendQuantType(
      selectedModel.parametersBillion,
      hardware.recommendedMaxModelGb
    );
  }, [selectedModel, hardware.recommendedMaxModelGb]);

  const selectedQuantInfo = selectedModel
    ? estimateCompressedSize(selectedModel.parametersBillion, quantType)
    : null;

  const families = useMemo(() => {
    const set = new Set(OLLAMA_MODELS.map((m) => m.family));
    return Array.from(set).sort();
  }, []);

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
          sourceModelId: selectedModel.hfRepoId,
          sourceModelName: `${selectedModel.name} (${selectedModel.ollamaId})`,
          method: "GGUF",
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Compress a Model</h1>
      <p className="text-gray-400 mb-6">
        Pick an Ollama model, choose your compression level, get a smaller GGUF.
      </p>

      {/* Hardware badge */}
      {hardware.detected && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Your Hardware (auto-detected)
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {hardware.gpuRenderer && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-gray-300">{hardware.gpuRenderer}</span>
                {hardware.vramGb && (
                  <span className="text-gray-500">({hardware.vramGb} GB VRAM)</span>
                )}
              </div>
            )}
            {hardware.ramGb && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-gray-300">{hardware.ramGb}+ GB RAM</span>
              </div>
            )}
            {hardware.cpuCores && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-gray-300">{hardware.cpuCores} CPU cores</span>
              </div>
            )}
            <div className="ml-auto text-gray-500">
              Max model size: ~{hardware.recommendedMaxModelGb} GB
            </div>
          </div>
        </div>
      )}

      {/* Progress steps */}
      <div className="flex gap-2 mb-8">
        {["Choose Model", "Compression Level", "Review & Compress"].map(
          (label, i) => (
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
          )
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Choose Model */}
      {step === 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1">
            Which model do you run?
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Select the Ollama model you want to compress. We&apos;ll pull the
            original unquantized weights from HuggingFace.
          </p>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setFamilyFilter(null);
            }}
            placeholder="Search models (qwen, gemma, llama, mistral, phi...)"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />

          {/* Family filters */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => {
                setFamilyFilter(null);
                setSearchQuery("");
              }}
              className={`px-3 py-1 rounded-full text-sm transition ${
                !familyFilter && !searchQuery
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              Featured
            </button>
            {families.map((family) => (
              <button
                key={family}
                onClick={() => {
                  setFamilyFilter(family);
                  setSearchQuery("");
                }}
                className={`px-3 py-1 rounded-full text-sm transition ${
                  familyFilter === family
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {family}
              </button>
            ))}
            <button
              onClick={() => {
                setFamilyFilter(null);
                setSearchQuery("");
              }}
              className={`px-3 py-1 rounded-full text-sm bg-gray-800 text-gray-400 hover:text-white transition`}
            >
              All ({OLLAMA_MODELS.length})
            </button>
          </div>

          {/* Model list */}
          <div className="space-y-2 max-h-[28rem] overflow-y-auto">
            {(searchQuery || familyFilter
              ? displayModels
              : displayModels.length > 0
                ? displayModels
                : OLLAMA_MODELS
            ).map((model) => {
              const fits =
                hardware.detected &&
                estimateCompressedSize(model.parametersBillion, "q4_k_m")
                  .sizeGb <= hardware.recommendedMaxModelGb;

              return (
                <button
                  key={model.ollamaId}
                  onClick={() => {
                    setSelectedModel(model);
                    setStep(2);
                  }}
                  className={`w-full text-left p-4 rounded-lg border transition ${
                    selectedModel?.ollamaId === model.ollamaId
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-white flex items-center gap-2">
                        {model.name}
                        <span className="text-xs text-gray-500 font-mono">
                          {model.ollamaId}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        {model.description}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <div className="text-sm font-mono text-gray-300">
                        {model.parametersBillion}B params
                      </div>
                      <div className="text-xs text-gray-500">
                        ~{model.fp16SizeGb} GB (FP16)
                      </div>
                      {hardware.detected && (
                        <div
                          className={`text-xs mt-1 ${fits ? "text-green-400" : "text-yellow-400"}`}
                        >
                          {fits ? "Fits your hardware" : "May need aggressive quant"}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Compression Level */}
      {step === 2 && selectedModel && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Compression Level for {selectedModel.name}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                Choose how aggressively to compress. Green = fits your hardware.
              </p>
            </div>
            <div className="text-right text-sm">
              <div className="text-gray-400">Original (FP16)</div>
              <div className="text-white font-mono">
                {selectedModel.fp16SizeGb} GB
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {quantRecommendations.map((rec) => {
              const sizeInfo = estimateCompressedSize(
                selectedModel.parametersBillion,
                rec.quantType
              );
              const isSelected = quantType === rec.quantType;
              const reductionPct = Math.round(
                ((selectedModel.fp16SizeGb - sizeInfo.sizeGb) /
                  selectedModel.fp16SizeGb) *
                  100
              );

              return (
                <button
                  key={rec.quantType}
                  onClick={() => setQuantType(rec.quantType)}
                  className={`w-full text-left p-4 rounded-lg border transition ${
                    isSelected
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          rec.fitsInMemory ? "bg-green-400" : "bg-yellow-400"
                        }`}
                      />
                      <div>
                        <span className="font-mono font-medium text-white">
                          {rec.quantType.toUpperCase()}
                        </span>
                        <span className="text-gray-400 text-sm ml-2">
                          {rec.label.replace(/Q\d.*\(/, "(").replace(/\)/, ")")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-gray-400 font-mono">
                        {sizeInfo.sizeGb} GB
                      </span>
                      <span className="text-green-400 font-mono w-16 text-right">
                        -{reductionPct}%
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          rec.fitsInMemory
                            ? "bg-green-500/10 text-green-400"
                            : "bg-yellow-500/10 text-yellow-400"
                        }`}
                      >
                        {rec.fitsInMemory ? "Fits" : "Tight"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
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
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Compress */}
      {step === 3 && selectedModel && selectedQuantInfo && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">
            Review & Compress
          </h2>

          <div className="space-y-4 mb-6">
            <div className="flex justify-between py-3 border-b border-gray-800">
              <span className="text-gray-400">Ollama Model</span>
              <span className="text-white font-medium">
                {selectedModel.name}{" "}
                <span className="text-gray-500 font-mono text-sm">
                  ({selectedModel.ollamaId})
                </span>
              </span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-800">
              <span className="text-gray-400">HuggingFace Source</span>
              <span className="text-white font-mono text-sm">
                {selectedModel.hfRepoId}
              </span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-800">
              <span className="text-gray-400">Parameters</span>
              <span className="text-white">
                {selectedModel.parametersBillion}B
              </span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-800">
              <span className="text-gray-400">Quantization</span>
              <span className="text-white font-mono">
                {quantType.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-800">
              <span className="text-gray-400">Original Size</span>
              <span className="text-white">
                ~{selectedModel.fp16SizeGb} GB (FP16)
              </span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-800">
              <span className="text-gray-400">Estimated Output Size</span>
              <span className="text-green-400 font-bold">
                ~{selectedQuantInfo.sizeGb} GB
              </span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-800">
              <span className="text-gray-400">Estimated Reduction</span>
              <span className="text-green-400 font-bold">
                {Math.round(
                  ((selectedModel.fp16SizeGb - selectedQuantInfo.sizeGb) /
                    selectedModel.fp16SizeGb) *
                    100
                )}
                % smaller
              </span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-gray-400">Output Format</span>
              <span className="text-white">
                GGUF (compatible with Ollama, llama.cpp, LM Studio)
              </span>
            </div>
          </div>

          {/* Ollama deployment preview */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-400 mb-2">
              After compression, run with Ollama:
            </div>
            <code className="text-green-400 text-sm font-mono">
              ollama create {selectedModel.ollamaId.split(":")[0]}-compressed -f
              Modelfile
            </code>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
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
