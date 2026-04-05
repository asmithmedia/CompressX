import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  createWriteStream,
  chmodSync,
  rmSync,
} from "node:fs";
import { homedir, platform, arch, tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import chalk from "chalk";
import ora from "ora";

/**
 * Auto-downloads llama.cpp binaries + conversion script into
 * ~/.compressx/bin/ on first compress when the user doesn't already
 * have them. Replaces the manual "download a release zip and unpack it"
 * step that was silently breaking first-run for every new user.
 *
 * Downloads:
 *   - The latest llama.cpp release binaries for the current platform
 *     (Windows x64, macOS arm64, Linux x64). CPU builds — fast enough
 *     for quantization, work on any machine, no CUDA toolchain needed.
 *   - convert_hf_to_gguf.py from the same release tag (needed for the
 *     HuggingFace --from-source path)
 *
 * All files land in ~/.compressx/bin/ where findLlamaCpp() looks for them.
 */

const BIN_DIR = join(homedir(), ".compressx", "bin");
const LLAMA_BIN_DIR = join(BIN_DIR, "llama-bin");
const GITHUB_API = "https://api.github.com/repos/ggerganov/llama.cpp/releases/latest";
const CONVERT_SCRIPT_URL = (tag: string) =>
  `https://raw.githubusercontent.com/ggerganov/llama.cpp/${tag}/convert_hf_to_gguf.py`;

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GithubRelease {
  tag_name: string;
  assets: ReleaseAsset[];
}

/**
 * Pick the right release asset for the current OS/arch.
 * llama.cpp publishes builds with platform suffixes like:
 *   llama-b8660-bin-win-cpu-x64.zip
 *   llama-b8660-bin-macos-arm64.zip
 *   llama-b8660-bin-ubuntu-x64.zip
 */
function pickAsset(release: GithubRelease): ReleaseAsset | null {
  const os = platform();
  const cpuArch = arch();

  const candidates = release.assets.filter((a) => {
    const name = a.name.toLowerCase();
    if (!name.endsWith(".zip") && !name.endsWith(".tar.gz")) return false;
    // Always prefer CPU builds for the auto-download path. Users with
    // CUDA can install the GPU build manually for faster quantization.
    if (name.includes("cuda") || name.includes("vulkan") || name.includes("sycl") || name.includes("hip")) {
      return false;
    }

    if (os === "win32") {
      return name.includes("win") && (name.includes("x64") || name.includes("amd64"));
    }
    if (os === "darwin") {
      return (
        name.includes("macos") &&
        (cpuArch === "arm64" ? name.includes("arm64") : name.includes("x64"))
      );
    }
    if (os === "linux") {
      return (
        (name.includes("ubuntu") || name.includes("linux")) &&
        (cpuArch === "arm64" ? name.includes("arm64") : name.includes("x64"))
      );
    }
    return false;
  });

  // Prefer "bin" builds (just binaries) over "full" builds (with examples)
  candidates.sort((a, b) => {
    const aBin = a.name.includes("bin") ? 1 : 0;
    const bBin = b.name.includes("bin") ? 1 : 0;
    return bBin - aBin;
  });

  return candidates[0] || null;
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "compressx-cli",
      Accept: "application/octet-stream",
    },
  });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }
  // @ts-expect-error — web streams to node streams bridge works in Node 18+
  await pipeline(res.body, createWriteStream(destPath));
}

/**
 * Extract a zip or tar.gz archive to a destination directory. Uses the
 * platform's native tool rather than a node dep — Windows has
 * Expand-Archive built in, macOS/Linux have unzip and tar.
 */
function extractArchive(archivePath: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });

  if (archivePath.endsWith(".tar.gz") || archivePath.endsWith(".tgz")) {
    const result = spawnSync("tar", ["-xzf", archivePath, "-C", destDir], {
      stdio: "pipe",
    });
    if (result.status !== 0) {
      throw new Error(`tar extraction failed: ${result.stderr?.toString()}`);
    }
    return;
  }

  if (archivePath.endsWith(".zip")) {
    if (platform() === "win32") {
      const result = spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
        ],
        { stdio: "pipe" },
      );
      if (result.status !== 0) {
        throw new Error(`Expand-Archive failed: ${result.stderr?.toString()}`);
      }
      return;
    }

    // macOS/Linux unzip
    const result = spawnSync("unzip", ["-oq", archivePath, "-d", destDir], {
      stdio: "pipe",
    });
    if (result.status !== 0) {
      throw new Error(`unzip failed: ${result.stderr?.toString()}`);
    }
    return;
  }

  throw new Error(`Unknown archive format: ${archivePath}`);
}

/**
 * Main entry point. Downloads and sets up llama.cpp in ~/.compressx/bin/.
 * Idempotent — if the files already exist, it skips the download.
 *
 * Returns true on success, false on failure. The caller is expected to
 * check findLlamaCpp() afterward to confirm the binary is discoverable.
 */
export async function setupLlamaCpp(): Promise<boolean> {
  mkdirSync(BIN_DIR, { recursive: true });

  const spinner = ora("Fetching latest llama.cpp release info...").start();
  let release: GithubRelease;
  try {
    const res = await fetch(GITHUB_API, {
      headers: { "User-Agent": "compressx-cli", Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
    release = (await res.json()) as GithubRelease;
  } catch (err) {
    spinner.fail("Could not reach GitHub API");
    console.error(chalk.red(`  ${err instanceof Error ? err.message : String(err)}`));
    return false;
  }
  spinner.succeed(`llama.cpp release ${release.tag_name}`);

  const asset = pickAsset(release);
  if (!asset) {
    console.error(
      chalk.red(
        `  No llama.cpp binary available for ${platform()}/${arch()}. You'll need to build from source.`,
      ),
    );
    return false;
  }

  const archivePath = join(tmpdir(), `compressx-${asset.name}`);
  const sizeLabel = `${(asset.size / 1024 / 1024).toFixed(1)} MB`;

  const dlSpinner = ora(`Downloading ${asset.name} (${sizeLabel})...`).start();
  try {
    await downloadFile(asset.browser_download_url, archivePath);
    dlSpinner.succeed(`Downloaded ${asset.name}`);
  } catch (err) {
    dlSpinner.fail("Download failed");
    console.error(chalk.red(`  ${err instanceof Error ? err.message : String(err)}`));
    return false;
  }

  const extractSpinner = ora("Extracting llama.cpp binaries...").start();
  try {
    // Clean any previous install first so stale files don't linger
    if (existsSync(LLAMA_BIN_DIR)) {
      rmSync(LLAMA_BIN_DIR, { recursive: true, force: true });
    }
    extractArchive(archivePath, LLAMA_BIN_DIR);
    // Clean up the downloaded archive
    rmSync(archivePath, { force: true });
    extractSpinner.succeed(
      "Extracted to ~/.compressx/bin/llama-bin/ (quantize + bench + perplexity)",
    );
  } catch (err) {
    extractSpinner.fail("Extraction failed");
    console.error(chalk.red(`  ${err instanceof Error ? err.message : String(err)}`));
    return false;
  }

  // Make the binaries executable on Unix. The llama.cpp release zips
  // contain quantize, bench, perplexity, cli, and a few others — we chmod
  // anything that looks like a llama-* binary so all paths work.
  if (platform() !== "win32") {
    const unixBinaries = ["llama-quantize", "llama-bench", "llama-perplexity", "llama-cli"];
    for (const name of unixBinaries) {
      const p = join(LLAMA_BIN_DIR, name);
      if (existsSync(p)) {
        try {
          chmodSync(p, 0o755);
        } catch {
          // ignore
        }
      }
    }
  }

  // Download convert_hf_to_gguf.py (for the --from-source HuggingFace path)
  const convertSpinner = ora("Downloading convert_hf_to_gguf.py...").start();
  try {
    const res = await fetch(CONVERT_SCRIPT_URL(release.tag_name), {
      headers: { "User-Agent": "compressx-cli" },
    });
    if (res.ok) {
      const script = await res.text();
      writeFileSync(join(BIN_DIR, "convert_hf_to_gguf.py"), script, "utf-8");
      convertSpinner.succeed("convert_hf_to_gguf.py ready");
    } else {
      // Not fatal — the script is only needed for --from-source path
      convertSpinner.warn(
        "Could not fetch convert_hf_to_gguf.py (only needed for --from-source)",
      );
    }
  } catch {
    convertSpinner.warn(
      "Could not fetch convert_hf_to_gguf.py (only needed for --from-source)",
    );
  }

  console.log();
  console.log(chalk.green("  llama.cpp is ready. Resuming compression..."));
  console.log();
  return true;
}
