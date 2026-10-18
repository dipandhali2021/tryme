import { readFileSync, writeFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stores/flipkart", () => ({ searchFlipkart: vi.fn() }));
vi.mock("@/lib/stores/myntra", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stores/myntra")>();
  return { ...actual, searchMyntra: vi.fn() };
});

import { cacheFile } from "@/lib/stores/cache";
import { searchFlipkart } from "@/lib/stores/flipkart";
import {
  MyntraBlockedError,
  myntraSlug,
  searchMyntra,
} from "@/lib/stores/myntra";
import { searchStore } from "@/lib/stores/search";
import type { Product } from "@/lib/stores/types";

const mockedFlipkart = vi.mocked(searchFlipkart);
const mockedMyntra = vi.mocked(searchMyntra);

const product: Product = {
  id: "p1",
  store: "flipkart",
  title: "Test Shirt",
  price: 499,
  gender: "men",
  category: "topwear",
  imageUrl: "https://rukmini1.flixcart.com/x.jpg",
  productUrl: "https://www.flipkart.com/x/p/itm1",
};

const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchStore", () => {
  it("fetches once, then serves from cache", async () => {
    const q = unique();
    mockedFlipkart.mockResolvedValue([product]);

    const first = await searchStore("flipkart", q);
    expect(first.cached).toBe(false);
    expect(first.products).toHaveLength(1);
    expect(first.error).toBeUndefined();

    const second = await searchStore("flipkart", q);
    expect(second.cached).toBe(true);
    expect(second.products).toHaveLength(1);
    expect(mockedFlipkart).toHaveBeenCalledTimes(1);
  });

  it("reports an error and negative-caches a cold failure", async () => {
    const q = unique();
    mockedFlipkart.mockRejectedValue(new Error("boom"));

    const first = await searchStore("flipkart", q);
    expect(first.error).toContain("boom");
    expect(first.products).toHaveLength(0);

    const second = await searchStore("flipkart", q);
    expect(second.error).toContain("boom");
    expect(mockedFlipkart).toHaveBeenCalledTimes(1);
  });

  it("serves the stale page when a refresh fails", async () => {
    const q = unique();
    mockedFlipkart.mockResolvedValueOnce([product]);
    await searchStore("flipkart", q);

    // Age the cached entry past the 6h TTL.
    const file = cacheFile("search", `search:flipkart:${q}:1`);
    const entry = JSON.parse(readFileSync(file, "utf8")) as { t: number };
    entry.t -= 7 * 60 * 60 * 1000;
    writeFileSync(file, JSON.stringify(entry));

    mockedFlipkart.mockRejectedValueOnce(new Error("still down"));
    const res = await searchStore("flipkart", q);
    expect(res.cached).toBe(true);
    expect(res.products).toHaveLength(1);
    expect(res.error).toBeUndefined();
  });

  it("returns the amazon fallback without fetching", async () => {
    const res = await searchStore("amazon", "blue shoes");
    expect(res.blocked).toBe(true);
    expect(res.fallbackSearchUrl).toBe("https://www.amazon.in/s?k=blue%20shoes");
    expect(res.products).toHaveLength(0);
    expect(mockedFlipkart).not.toHaveBeenCalled();
  });

  it("routes a cloud-blocked Myntra search to its fallback panel", async () => {
    const q = unique();
    mockedMyntra.mockRejectedValue(
      new MyntraBlockedError("gateway 403, page 200/483b"),
    );

    const res = await searchStore("myntra", q);
    expect(res.blocked).toBe(true);
    expect(res.fallbackSearchUrl).toBe(`https://www.myntra.com/${myntraSlug(q)}`);
    expect(res.products).toHaveLength(0);
    expect(res.error).toContain("myntra blocked");
    expect(mockedMyntra).toHaveBeenCalledTimes(1);
  });
});
