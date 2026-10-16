import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { myntraSearchUrl, parseMyntraState } from "@/lib/stores/myntra";

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "src/test/fixtures/myntra-state.json"), "utf8"),
) as unknown;

describe("parseMyntraState", () => {
  const products = parseMyntraState(fixture);

  it("extracts 20 products", () => {
    expect(products).toHaveLength(20);
  });

  it("normalizes every product", () => {
    for (const p of products) {
      expect(p.store).toBe("myntra");
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.price).toBeGreaterThan(0);
      expect(p.imageUrl).toMatch(/^https:\/\//);
      expect(p.imageUrl).toContain("myntassets");
      expect(p.productUrl).toContain("myntra.com");
      expect(p.productUrl).toContain("/buy");
    }
  });

  it("matches a hand-checked product", () => {
    const first = products[0];
    expect(first.title).toBe(
      "Levis Men Soft Pure Cotton Round Neck Half Sleeve Tshirt",
    );
    expect(first.brand).toBe("Levis");
    expect(first.price).toBe(421);
    expect(first.mrp).toBe(649);
    expect(first.discountPct).toBe(35);
    expect(first.gender).toBe("men");
    expect(first.category).toBe("topwear");
    expect(first.color).toBe("White");
  });

  it("maps retailer gender values", () => {
    const genders = new Set(products.map((p) => p.gender));
    for (const g of genders) {
      expect(["men", "women", "unisex", "kids", "unknown"]).toContain(g);
    }
  });

  it("deduplicates by product id", () => {
    const ids = products.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("myntraSearchUrl", () => {
  it("slugifies the query", () => {
    expect(myntraSearchUrl("men tshirt")).toBe("https://www.myntra.com/men-tshirt");
    expect(myntraSearchUrl("Women Jeans")).toBe("https://www.myntra.com/women-jeans");
  });

  it("strips punctuation from the slug", () => {
    expect(myntraSearchUrl("men's t-shirts!")).toBe(
      "https://www.myntra.com/mens-t-shirts",
    );
  });
});
