import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import type { DeploymentTarget, DeploymentContext, PreCheckResult } from "./types.js";

/**
 * LMStudioTarget drops the compressed GGUF into LM Studio's local models
 * directory, using LM Studio's convention of <Publisher>/<Repo>/<file>.gguf.
 *
 * LM Studio reads this directory on startup and when you click "Rescan"
 * under "My Models", so no API call is needed — just a filesystem copy.
 *
 * Location:
 *   macOS / Linux:  ~/.lmstudio/models/<Publisher>/<Repo>/<file>.gguf
 *   Windows:        %USERPROFILE%\.lmstudio\models\<Publisher>\<Repo>\<file>.gguf
 */
export class LMStudioTarget implements DeploymentTarget {
  readonly id = "lmstudio" as const;
  readonly name = "LM Studio";

  private getModelsDir(): string {
    return join(homedir(), ".lmstudio", "models");
  }

  /**
   * Parse the HuggingFace repo id into <Publisher>/<Repo>.
   * "Qwen/Qwen3-4B" -> { publisher: "Qwen", repo: "Qwen3-4B" }
   * Fallback: treat the full slug as the repo under a "compressx" publisher.
   */
  private parseRepo(hfRepoId: string): { publisher: string; repo: string } {
    const parts = hfRepoId.split("/");
    if (parts.length >= 2) {
      return { publisher: parts[0], repo: parts.slice(1).join("-") };
    }
    return { publisher: "compressx", repo: hfRepoId };
  }

  private targetPath(ctx: DeploymentContext): string {
    const { publisher, repo } = this.parseRepo(ctx.hfRepoId);
    return join(this.getModelsDir(), publisher, repo, basename(ctx.outputPath));
  }

  async preCompressionCheck(): Promise<PreCheckResult> {
    // LM Studio doesn't need to be running — we just copy to a directory.
    // We warn if the models directory doesn't exist, which usually means
    // LM Studio was never opened on this machine.
    const modelsDir = this.getModelsDir();
    if (!existsSync(modelsDir)) {
      return {
        ok: true,
        message: `Note: LM Studio's models directory (${modelsDir}) doesn't exist yet. It will be created. If LM Studio is installed and you expected a different location, open LM Studio > Settings > Local Models to confirm.`,
      };
    }
    return { ok: true };
  }

  async modelExists(ctx: DeploymentContext): Promise<boolean> {
    return existsSync(this.targetPath(ctx));
  }

  async register(ctx: DeploymentContext): Promise<void> {
    const dest = this.targetPath(ctx);
    const destDir = join(dest, "..");
    mkdirSync(destDir, { recursive: true });
    copyFileSync(ctx.outputPath, dest);
  }

  getInstructions(ctx: DeploymentContext): string {
    const { publisher, repo } = this.parseRepo(ctx.hfRepoId);
    return `Open LM Studio -> My Models -> ${publisher}/${repo}`;
  }

  getExtraSummaryLines(ctx: DeploymentContext): string[] {
    return [`Installed at: ${this.targetPath(ctx)}`];
  }
}
