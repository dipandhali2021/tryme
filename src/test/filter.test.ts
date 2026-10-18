import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  applyFilters,
  composeGenderQuery,
  deriveBrands,
  deriveColors,
  type Filters,
} from "@/lib/stores/filter";
import type { Product } from "@/lib/stores/types";

const product = (over: Partial<Product> & { id: string }): Product => ({
  store: "flipkart",
  title: "Test item",
  price: 500,
  gender: "men",
  category: "topwear",
  imageUrl: "https://cdn/x.jpg",
  productUrl: "https://www.flipkart.com/x/p/itm1",
  ...over,
});

const catalog: Product[] = [
  product({ id: "a", price: 200, color: "White", brand: "Levis", discountPct: 50 }),
  product({
    id: "b",
    price: 800,
    color: "Blue",
    brand: "Levis",
    discountPct: 20,
    category: "bottomwear",
    gender: "women",
  }),
  product({
    id: "c",
    price: 1500,
    color: "Blue",
    brand: "Zara",
    category: "dress",
    gender: "women",
  }),
  product({
    id: "d",
    price: 5000,
    color: "Black",
    brand: "Nike",
    discountPct: 10,
    category: "footwear",
    gender: "unisex",
  }),
  product({ id: "f", price: 300 }), // no color, no brand
];

const filters = (over: Partial<Filters>): Filters => ({
  ...DEFAULT_FILTERS,
  ...over,
});

const ids = (products: Product[]) => products.map((p) => p.id);

describe("applyFilters", () => {
  it("filters by category", () => {
    expect(ids(applyFilters(catalog, filters({ category: "topwear" })))).toEqual([
      "a",
      "f",
    ]);
    expect(ids(applyFilters(catalog, filters({ category: "all" })))).toHaveLength(5);
  });

  it("treats price bounds as inclusive", () => {
    expect(ids(applyFilters(catalog, filters({ priceMin: 200, priceMax: 800 })))).toEqual(
      ["a", "b", "f"],
    );
  });

  it("filters by a color subset, dropping colorless items", () => {
    expect(ids(applyFilters(catalog, filters({ colors: ["Blue"] })))).toEqual([
      "b",
      "c",
    ]);
    expect(
      ids(applyFilters(catalog, filters({ colors: ["Blue", "Black"] }))),
    ).toEqual(["b", "c", "d"]);
  });

  it("filters by a brand subset, dropping brandless items", () => {
    expect(ids(applyFilters(catalog, filters({ brands: ["Levis"] })))).toEqual([
      "a",
      "b",
    ]);
  });

  it("filters by gender", () => {
    expect(ids(applyFilters(catalog, filters({ gender: "women" })))).toEqual([
      "b",
      "c",
    ]);
    expect(ids(applyFilters(catalog, filters({ gender: "unisex" })))).toEqual([
      "d",
    ]);
  });

  it("sorts by price ascending and descending", () => {
    expect(ids(applyFilters(catalog, filters({ sort: "price_asc" })))).toEqual([
      "a",
      "f",
      "b",
      "c",
      "d",
    ]);
    expect(ids(applyFilters(catalog, filters({ sort: "price_desc" })))).toEqual([
      "d",
      "c",
      "b",
      "f",
      "a",
    ]);
  });

  it("sorts by discount, treating missing discounts as zero and staying stable", () => {
    expect(
      ids(applyFilters(catalog, filters({ sort: "discount_desc" }))),
    ).toEqual(["a", "b", "d", "c", "f"]);
  });

  it("keeps relevance order by default", () => {
    expect(ids(applyFilters(catalog, DEFAULT_FILTERS))).toEqual([
      "a",
      "b",
      "c",
      "d",
      "f",
    ]);
  });

  it("combines filters", () => {
    expect(
      ids(
        applyFilters(
          catalog,
          filters({ colors: ["Blue"], gender: "women", priceMax: 1000 }),
        ),
      ),
    ).toEqual(["b"]);
  });
});

describe("deriveBrands", () => {
  it("dedupes, drops empty, and sorts alphabetically", () => {
    expect(deriveBrands(catalog)).toEqual(["Levis", "Nike", "Zara"]);
  });
});

describe("deriveColors", () => {
  it("dedupes, drops empty, and sorts alphabetically", () => {
    expect(deriveColors(catalog)).toEqual(["Black", "Blue", "White"]);
  });
});

describe("composeGenderQuery", () => {
  it("prepends the facet so the store searches it", () => {
    expect(composeGenderQuery("shirt", "women")).toBe("women shirt");
    expect(composeGenderQuery("jeans", "men")).toBe("men jeans");
  });

  it("leaves the query alone for all and unisex", () => {
    expect(composeGenderQuery("shirt", "all")).toBe("shirt");
    expect(composeGenderQuery("shirt", "unisex")).toBe("shirt");
  });

  it("doesn't double up when the query already carries the facet", () => {
    expect(composeGenderQuery("women shirt", "women")).toBe("women shirt");
    expect(composeGenderQuery("mens tshirt", "men")).toBe("mens tshirt");
    expect(composeGenderQuery("Womens kurta", "women")).toBe("Womens kurta");
    expect(composeGenderQuery("men's shoes", "men")).toBe("men's shoes");
  });
});
