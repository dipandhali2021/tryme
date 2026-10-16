import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { flipkartSearchUrl, parseFlipkartState } from "@/lib/stores/flipkart";

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "src/test/fixtures/flipkart-state.json"), "utf8"),
) as unknown;

describe("parseFlipkartState", () => {
  const products = parseFlipkartState(fixture);

  it("extracts 20 products", () => {
    expect(products).toHaveLength(20);
  });

  it("normalizes every product", () => {
    for (const p of products) {
      expect(p.store).toBe("flipkart");
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.price).toBeGreaterThan(0);
      expect(p.imageUrl).toMatch(/^https:\/\//);
      expect(p.imageUrl).toContain("flixcart.com");
      expect(p.productUrl).toContain("flipkart.com");
    }
  });

  it("matches a hand-checked product", () => {
    const first = products[0];
    expect(first.title).toBe("3BROS Printed Men Polo Neck Brown T-Shirt");
    expect(first.price).toBe(246);
    expect(first.mrp).toBe(999);
    expect(first.discountPct).toBe(75);
    expect(first.brand).toBe("3BROS");
    expect(first.category).toBe("topwear");
    expect(first.productUrl).toContain("/p/itm");
  });

  it("deduplicates by product id", () => {
    const ids = products.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("flipkartSearchUrl", () => {
  it("encodes the query", () => {
    expect(flipkartSearchUrl("men t-shirt")).toBe(
      "https://www.flipkart.com/search?q=men%20t-shirt",
    );
  });

  it("adds a page param when page > 1", () => {
    expect(flipkartSearchUrl("shirt", 2)).toContain("&page=2");
    expect(flipkartSearchUrl("shirt", 1)).not.toContain("page=");
  });
});
