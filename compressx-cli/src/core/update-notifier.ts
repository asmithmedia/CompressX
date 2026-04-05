import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import chalk from "chalk";

const CACHE_DIR = join(homedir(), ".compressx");
const CACHE_FILE = join(CACHE_DIR, "update-check.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NPM_REGISTRY = "https://registry.npmjs.org/compressx/latest";
const FETCH_TIMEOUT_MS = 2000;

interface CacheEntry {
  checkedAt: number;
  latestVersion: string;
}

function readCache(): CacheEntry | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const raw = readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeCache(entry: CacheEntry) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(entry), "utf-8");
  } catch {
    // silent — cache write failures should never affect the user
  }
}

/**
 * Simple semver-ish comparison. Returns true if `b` is newer than `a`.
 */
function isNewer(current: string, latest: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/^v/, "")
      .split("-")[0]
      .split(".")
      .map((n) => parseInt(n, 10) || 0);

  const a = parse(current);
  const b = parse(latest);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (bi > ai) return true;
    if (bi < ai) return false;
  }
  return false;
}

/**
 * Kick off an async refresh of the update cache in the background.
 * Uses .unref() on timers so it never blocks process exit.
 * Swallows all errors.
 */
function refreshCacheInBackground() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  // Critical: don't hold the event loop open for this.
  (timer as unknown as { unref?: () => void }).unref?.();

  fetch(NPM_REGISTRY, {
    signal: controller.signal,
    headers: { Accept: "application/json" },
  })
    .then(async (res) => {
      clearTimeout(timer);
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      if (data.version) {
        writeCache({ checkedAt: Date.now(), latestVersion: data.version });
      }
    })
    .catch(() => {
      clearTimeout(timer);
      // silent — no network, registry down, whatever. Just skip this check.
    });
}

/**
 * Synchronously checks the cached update info. Returns the latest version
 * only if the cache says a newer version exists.
 *
 * If the cache is stale or missing, fires a background refresh (non-blocking,
 * unref'd) so the NEXT CLI invocation will see the updated info.
 *
 * This pattern means update notifications are always "one invocation stale",
 * which is fine — the user runs the CLI often enough that they'll see it.
 * The trade-off is zero network blocking on the current command.
 *
 * Opt out entirely via COMPRESSX_NO_UPDATE_CHECK=1.
 */
export function checkForUpdatesSync(currentVersion: string): { latest: string; hasUpdate: boolean } | null {
  if (process.env.COMPRESSX_NO_UPDATE_CHECK === "1") {
    return null;
  }

  const cache = readCache();
  const now = Date.now();
  const cacheIsFresh = cache && now - cache.checkedAt < CACHE_TTL_MS;

  if (!cacheIsFresh) {
    // Kick off a refresh for next time, don't wait.
    refreshCacheInBackground();
  }

  if (!cache) return null;

  if (isNewer(currentVersion, cache.latestVersion)) {
    return { latest: cache.latestVersion, hasUpdate: true };
  }
  return null;
}

/**
 * Print a one-line update banner.
 */
export function printUpdateBanner(current: string, latest: string) {
  const line1 = `  Update available: ${current} -> ${latest}`;
  const line2 = `  Run: compressx update`;
  const width = Math.max(line1.length, line2.length) + 4;
  const border = "  +" + "-".repeat(width) + "+";

  console.log("");
  console.log(chalk.yellow(border));
  console.log(
    chalk.yellow("  |  ") +
      chalk.white(`Update available: ${chalk.gray(current)} -> ${chalk.green(latest)}`) +
      chalk.yellow("  |".padStart(width - line1.length + 1)),
  );
  console.log(
    chalk.yellow("  |  ") +
      chalk.gray("Run: ") +
      chalk.cyan("compressx update") +
      chalk.yellow("  |".padStart(width - line2.length + 1)),
  );
  console.log(chalk.yellow(border));
  console.log("");
}
