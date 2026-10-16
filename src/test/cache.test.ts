import { rmSync, writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { cacheFile, cacheGet, cacheSet } from "@/lib/stores/cache";

const KEY = `test-${process.pid}-${Math.random().toString(36).slice(2)}`;

afterAll(() => {
  rmSync(cacheFile("search", KEY), { force: true });
  rmSync(cacheFile("images", KEY), { force: true });
});

describe("disk cache", () => {
  it("stores and retrieves a value", () => {
    const value = { hello: "world", n: 42 };
    cacheSet(KEY, value);
    expect(cacheGet(KEY, 60_000)).toEqual(value);
  });

  it("returns null when the entry is missing", () => {
    expect(cacheGet(`missing-${KEY}`, 60_000)).toBeNull();
  });

  it("returns null when the ttl has expired", () => {
    cacheSet(KEY, { fresh: true });
    expect(cacheGet(KEY, -1)).toBeNull();
  });

  it("returns null for a corrupted file instead of throwing", () => {
    writeFileSync(cacheFile("search", KEY), "{not json!!");
    expect(cacheGet(KEY, 60_000)).toBeNull();
  });

  it("names search and image entries under separate directories", () => {
    expect(cacheFile("search", KEY)).toContain("/.cache/search/");
    expect(cacheFile("images", KEY)).toContain("/.cache/images/");
    expect(cacheFile("search", KEY)).not.toBe(cacheFile("images", KEY));
  });
});
