import { describe, expect, it } from "vitest";
import { inferCategory, inferGender, parseINR } from "@/lib/stores/normalize";

describe("parseINR", () => {
  it.each([
    ["₹1,199", 1199],
    ["₹1,19,999", 119999],
    ["₹ 499", 499],
    ["Rs. 999", 999],
    ["Rs 1,049.50", 1050],
    ["1199", 1199],
  ])("parses %s → %d", (raw, expected) => {
    expect(parseINR(raw)).toBe(expected);
  });

  it.each([["Free"], [""], ["Sold Out"], ["₹—"]])(
    "returns null for %s",
    (raw) => {
      expect(parseINR(raw)).toBeNull();
    },
  );
});

describe("inferCategory", () => {
  it.each([
    ["Men Slim Fit Cotton T-Shirt", "topwear"],
    ["Women's Floral Kurta", "topwear"],
    ["Solid Polo Neck Jacket", "topwear"],
    ["Dark Blue Slim Fit Jeans", "bottomwear"],
    ["Women Black Joggers", "bottomwear"],
    ["Evening Gown", "dress"],
    ["Cotton Anarkali Dress", "dress"],
    ["Running Shoes", "footwear"],
    ["Tan Block Heels", "footwear"],
    ["Leather Belt", "accessory"],
    ["Analog Watch", "accessory"],
    ["Smartphone 128GB", "other"],
    ["Laptop Sleeve Organizer", "other"],
  ])("classifies %s → %s", (title, expected) => {
    expect(inferCategory(title)).toBe(expected);
  });
});

describe("inferGender", () => {
  it.each([
    ["Men Slim Fit T-Shirt", "men"],
    ["Mens Casual Shirt", "men"],
    ["Women's Floral Kurta", "women"],
    ["Womens High-Rise Jeans", "women"],
    ["Unisex Oversized Hoodie", "unisex"],
    ["Boys Cotton Shorts", "kids"],
    ["Girls Party Frock", "kids"],
    ["Baby Romper Pack", "kids"],
    ["Solid Black Tee", "unknown"],
  ])("infers %s → %s", (title, expected) => {
    expect(inferGender(title)).toBe(expected);
  });

  it("falls back to context when the title is silent", () => {
    expect(inferGender("Cotton Kurta", "Women")).toBe("women");
    expect(inferGender("Classic Fit Shirt", "men")).toBe("men");
  });

  it("prefers the title over the context", () => {
    expect(inferGender("Women's Kurta", "men")).toBe("women");
  });
});
