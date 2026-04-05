import type { DeploymentTarget, DeploymentTargetId } from "./types.js";
import { OllamaTarget } from "./ollama.js";
import { LMStudioTarget } from "./lmstudio.js";
import { GGUFTarget } from "./gguf.js";

export type { DeploymentTarget, DeploymentTargetId, DeploymentContext, PreCheckResult } from "./types.js";

const TARGETS: Record<DeploymentTargetId, () => DeploymentTarget> = {
  ollama: () => new OllamaTarget(),
  lmstudio: () => new LMStudioTarget(),
  gguf: () => new GGUFTarget(),
};

export function getDeploymentTarget(id: string): DeploymentTarget {
  const key = id.toLowerCase() as DeploymentTargetId;
  const factory = TARGETS[key];
  if (!factory) {
    throw new Error(
      `Unknown deployment target: "${id}". Valid targets: ${Object.keys(TARGETS).join(", ")}`,
    );
  }
  return factory();
}

export function listDeploymentTargets(): DeploymentTargetId[] {
  return Object.keys(TARGETS) as DeploymentTargetId[];
}
