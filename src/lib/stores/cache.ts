import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type CacheKind = "search" | "images";

const CACHE_ROOT = join(process.cwd(), ".cache");

/** Deterministic on-disk path for a cache entry: .cache/<kind>/<sha1(key)>.json */
export function cacheFile(kind: CacheKind, key: string): string {
  const digest = createHash("sha1").update(key).digest("hex");
  return join(CACHE_ROOT, kind, `${digest}.json`);
}

type Entry<T> = { t: number; v: T };

/**
 * Read a cached value; null on missing, expired, or corrupted entries.
 * Negative ttlMs always misses (used for manual invalidation tests).
 */
export function cacheGet<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = readFileSync(cacheFile("search", key), "utf8");
    const entry = JSON.parse(raw) as Entry<T>;
    if (typeof entry.t !== "number") return null;
    if (Date.now() - entry.t > ttlMs) return null;
    return entry.v;
  } catch {
    return null;
  }
}

/** Write a value to the disk cache, creating directories as needed. */
export function cacheSet<T>(key: string, value: T): void {
  const file = cacheFile("search", key);
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ t: Date.now(), v: value } satisfies Entry<T>));
  } catch {
    // Cache writes are best-effort; never break the caller.
  }
}
