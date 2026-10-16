import { existsSync, rmSync } from "node:fs";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  fetchAndCacheImage,
  isAllowedImageHost,
  refererFor,
} from "@/lib/images/proxy";

const unique = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const okUrl = `https://rukmini1.flixcart.com/image/512/512/${unique}.jpg`;
const cached: string[] = [];

afterAll(() => {
  for (const file of cached) {
    rmSync(file, { force: true });
    rmSync(`${file}.meta`, { force: true });
  }
});

describe("isAllowedImageHost", () => {
  it.each([
    ["https://rukminim1.flixcart.com/image/1/x.jpeg?q=70", true],
    ["https://rukminim2.flixcart.com/image/1/x.jpeg", true],
    ["https://rukmini1.flixcart.com/image/512/512/x.jpeg", true],
    ["https://assets.myntassets.com/assets/images/1.jpg", true],
    ["https://constant.myntassets.com/h_144,w_108/x.jpg", true],
    ["https://m.media-amazon.com/images/I/71abc.jpg", true],
    ["https://rukminim1.flixcart.com.evil.com/x.jpg", false],
    ["https://evil.com/rukminim1.flixcart.com.jpg", false],
    ["https://flixcart.com/x.jpg", false],
    ["ftp://rukmini1.flixcart.com/x.jpg", false],
    ["not a url", false],
  ])("%s → %s", (url, expected) => {
    expect(isAllowedImageHost(url)).toBe(expected);
  });
});

describe("refererFor", () => {
  it.each([
    ["https://rukminim1.flixcart.com/image/x.jpeg", "https://www.flipkart.com/"],
    ["https://assets.myntassets.com/assets/images/x.jpg", "https://www.myntra.com/"],
    ["https://m.media-amazon.com/images/I/x.jpg", "https://www.amazon.in/"],
    ["https://example.com/x.jpg", null],
  ])("%s → %s", (url, expected) => {
    expect(refererFor(url)).toBe(expected);
  });
});

describe("fetchAndCacheImage", () => {
  it("downloads, caches, and reuses without refetching", async () => {
    const bytes = new TextEncoder().encode("fake-image-bytes");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: async () => bytes.buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchAndCacheImage(okUrl);
    expect(first?.contentType).toBe("image/jpeg");
    expect(first && existsSync(first.path)).toBe(true);
    if (first) cached.push(first.path);

    const second = await fetchAndCacheImage(okUrl);
    expect(second?.path).toBe(first?.path);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("returns null on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, headers: new Headers() }),
    );
    expect(await fetchAndCacheImage(`${okUrl}?missing=1`)).toBeNull();
    vi.unstubAllGlobals();
  });

  it("returns null without fetching for a disallowed host", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchAndCacheImage("https://evil.com/x.jpg")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
