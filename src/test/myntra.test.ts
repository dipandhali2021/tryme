import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cookieHeader,
  myntraGatewayUrl,
  myntraSearchUrl,
  parseMyntraGateway,
  parseMyntraState,
} from "@/lib/stores/myntra";

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

describe("parseMyntraGateway", () => {
  const products = parseMyntraGateway({
    responseType: "LIST",
    hasNextPage: true,
    totalCount: 361843,
    products: [
      {
        productId: 36597142,
        productName:
          "max Girls Striped Spread Collar Regular Fit Pure Cotton Casual Shirt",
        brand: "max",
        price: 499,
        mrp: 599,
        searchImage: "http://assets.myntassets.com/assets/images/a.jpg",
        landingPageUrl: "Shirts/max/max-Girls-Shirt/36597142/buy",
        gender: "Girls",
        primaryColour: "Blue",
        rating: 4.4,
      },
      { productId: 1, product: "broken — no image" },
    ],
  });

  it("maps gateway products onto the shared shape", () => {
    expect(products).toHaveLength(1);
    const p = products[0];
    expect(p.store).toBe("myntra");
    expect(p.id).toBe("36597142");
    expect(p.brand).toBe("max");
    expect(p.price).toBe(499);
    expect(p.mrp).toBe(599);
    expect(p.discountPct).toBe(17);
    expect(p.gender).toBe("kids");
    expect(p.color).toBe("Blue");
    expect(p.imageUrl).toMatch(/^https:\/\//);
    expect(p.productUrl).toBe(
      "https://www.myntra.com/Shirts/max/max-Girls-Shirt/36597142/buy",
    );
  });

  it("is empty for missing or malformed bodies", () => {
    expect(parseMyntraGateway(null)).toEqual([]);
    expect(parseMyntraGateway({})).toEqual([]);
    expect(parseMyntraGateway({ products: "nope" })).toEqual([]);
  });
});

describe("myntraGatewayUrl", () => {
  it("paginates with rows and offset", () => {
    expect(myntraGatewayUrl("men shirt", 1)).toBe(
      "https://www.myntra.com/gateway/v2/search/men-shirt?p=1&rows=40&o=0&plaEnabled=false",
    );
    expect(myntraGatewayUrl("men shirt", 3)).toBe(
      "https://www.myntra.com/gateway/v2/search/men-shirt?p=3&rows=40&o=80&plaEnabled=false",
    );
  });
});

describe("cookieHeader", () => {
  it("keeps only the name=value pairs", () => {
    expect(
      cookieHeader(["a=1; Path=/; Secure", " b=2 ; HttpOnly", ""]),
    ).toBe("a=1; b=2");
  });

  it("is empty for no cookies", () => {
    expect(cookieHeader([])).toBe("");
  });
});
