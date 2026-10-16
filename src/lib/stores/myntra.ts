import { extractJsonAfterMarker } from "@/lib/stores/extract";
import { inferCategory, inferGender } from "@/lib/stores/normalize";
import type { Gender, Product } from "@/lib/stores/types";

export function myntraSearchUrl(q: string, page = 1): string {
  const slug = q
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const url = `https://www.myntra.com/${slug}`;
  return page > 1 ? `${url}?p=${page}` : url;
}

const CHROME_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type MyntraValue = {
  productId?: number | string;
  product?: string;
  productName?: string;
  brand?: string;
  price?: number;
  mrp?: number;
  searchImage?: string;
  images?: Array<{ src?: string }>;
  landingPageUrl?: string;
  rating?: number;
  gender?: string;
  primaryColour?: string;
};

/** Upgrade the scheme and request a try-on-friendly render size. */
function myntraImage(url: unknown): string {
  if (typeof url !== "string" || !url) return "";
  const https = url.replace(/^http:\/\//, "https://");
  return https.includes("?") ? https : `${https}?q=80&w=512`;
}

/** Myntra ships a gender field ("Men", "Unisex Kids", …); trust it first. */
function myntraGender(raw: string | undefined, title: string): Gender {
  const t = (raw ?? "").toLowerCase();
  if (t.includes("kid") || t === "boys" || t === "girls") return "kids";
  if (t === "men") return "men";
  if (t === "women") return "women";
  if (t === "unisex") return "unisex";
  return inferGender(title);
}

function toProduct(value: MyntraValue): Product | null {
  const id = value.productId != null ? String(value.productId) : "";
  const title = value.product ?? value.productName ?? "";
  const price = typeof value.price === "number" ? value.price : null;
  if (!id || !title || !price || price <= 0) return null;

  const mrp =
    typeof value.mrp === "number" && value.mrp > price ? value.mrp : undefined;
  const discountPct = mrp
    ? Math.round(((mrp - price) / mrp) * 100)
    : undefined;

  const imageUrl = myntraImage(value.searchImage ?? value.images?.[0]?.src);
  const productUrl = value.landingPageUrl
    ? new URL(value.landingPageUrl, "https://www.myntra.com/").toString()
    : `https://www.myntra.com/${id}/buy`;
  if (!imageUrl) return null;

  return {
    id,
    store: "myntra",
    title,
    brand: value.brand || undefined,
    price,
    mrp,
    discountPct,
    color: value.primaryColour || undefined,
    gender: myntraGender(value.gender, title),
    category: inferCategory(title),
    imageUrl,
    productUrl,
    rating:
      typeof value.rating === "number" && value.rating > 0
        ? value.rating
        : undefined,
  };
}

/** Parse the `window.__myx` search payload into normalized products. */
export function parseMyntraState(state: unknown): Product[] {
  const record = state as {
    searchData?: { results?: { products?: unknown } };
  } | null;
  const raw = record?.searchData?.results?.products;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const products: Product[] = [];
  for (const item of raw) {
    const product = toProduct(item as MyntraValue);
    if (product && !seen.has(product.id)) {
      seen.add(product.id);
      products.push(product);
    }
  }
  return products;
}

/** Fetch a Myntra search page and parse its product list. */
export async function searchMyntra(q: string, page = 1): Promise<Product[]> {
  const res = await fetch(myntraSearchUrl(q, page), {
    headers: {
      "user-agent": CHROME_UA,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-IN,en;q=0.9",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`myntra search failed: ${res.status}`);
  const html = await res.text();
  return parseMyntraState(extractJsonAfterMarker(html, "window.__myx ="));
}
