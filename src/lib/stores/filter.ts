import type { Category, Product } from "@/lib/stores/types";

export type Filters = {
  category: Category | "all";
  priceMin: number;
  priceMax: number;
  colors: string[];
  brands: string[];
  gender: "all" | "men" | "women" | "unisex";
  sort: "relevance" | "price_asc" | "price_desc" | "discount_desc";
};

export const DEFAULT_FILTERS: Filters = {
  category: "all",
  priceMin: 0,
  priceMax: 5000,
  colors: [],
  brands: [],
  gender: "all",
  sort: "relevance",
};

/**
 * Fold the gender facet into the store query ("shirt" + women → "women
 * shirt") so the chip brings in new results instead of only sifting the
 * page the store already returned. "all" and "unisex" are pure filters.
 */
export function composeGenderQuery(
  q: string,
  gender: Filters["gender"],
): string {
  if (gender !== "men" && gender !== "women") return q;
  const hasFacet = q
    .toLowerCase()
    .split(/\s+/)
    .some((word) => word.replace(/[^a-z]/g, "").startsWith(gender));
  return hasFacet ? q : `${gender} ${q}`;
}

/** Apply the filter bar to a product list. Price bounds are inclusive. */
export function applyFilters(products: Product[], f: Filters): Product[] {
  const filtered = products.filter((p) => {
    if (f.category !== "all" && p.category !== f.category) return false;
    if (p.price < f.priceMin || p.price > f.priceMax) return false;
    if (f.colors.length > 0 && (!p.color || !f.colors.includes(p.color))) {
      return false;
    }
    if (f.brands.length > 0 && (!p.brand || !f.brands.includes(p.brand))) {
      return false;
    }
    if (f.gender !== "all" && p.gender !== f.gender) return false;
    return true;
  });

  switch (f.sort) {
    case "price_asc":
      return [...filtered].sort((a, b) => a.price - b.price);
    case "price_desc":
      return [...filtered].sort((a, b) => b.price - a.price);
    case "discount_desc":
      return [...filtered].sort(
        (a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0),
      );
    default:
      return filtered;
  }
}

/** Distinct, alphabetically sorted brand names present in a result set. */
export function deriveBrands(products: Product[]): string[] {
  const set = new Set<string>();
  for (const p of products) {
    if (p.brand) set.add(p.brand);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Distinct, alphabetically sorted color names present in a result set. */
export function deriveColors(products: Product[]): string[] {
  const set = new Set<string>();
  for (const p of products) {
    if (p.color) set.add(p.color);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
