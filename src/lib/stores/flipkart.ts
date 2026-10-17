import { extractJsonAfterMarker } from "@/lib/stores/extract";
import { inferCategory, inferGender } from "@/lib/stores/normalize";
import type { Product } from "@/lib/stores/types";

export function flipkartSearchUrl(q: string, page = 1): string {
  const base = `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`;
  return page > 1 ? `${base}&page=${page}` : base;
}

const CHROME_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type FlipkartPrice = {
  priceType?: string;
  value?: number;
  currency?: string;
};

type FlipkartValue = {
  id?: string;
  baseUrl?: string;
  titles?: { title?: string; newTitle?: string; superTitle?: string };
  pricing?: { prices?: FlipkartPrice[] };
  media?: { images?: Array<{ url?: string }> };
  analyticsData?: {
    category?: string;
    subCategory?: string;
    superCategory?: string;
    vertical?: string;
  };
};

/** Resolve the template placeholders Flipkart uses in image URLs. */
function flipkartImage(url: unknown): string {
  if (typeof url !== "string" || !url) return "";
  return url
    .replace("{@width}", "512")
    .replace("{@height}", "512")
    .replace("{@quality}", "70")
    .replace(/^http:\/\//, "https://");
}

function toProduct(value: FlipkartValue): Product | null {
  const id = typeof value.id === "string" && value.id ? value.id : null;
  const title = value.titles?.title ?? value.titles?.newTitle ?? null;
  const prices = Array.isArray(value.pricing?.prices) ? value.pricing.prices : [];
  const special = prices.find((p) => p?.priceType === "SPECIAL_PRICE");
  const fsp = prices.find((p) => p?.priceType === "FSP");
  const price =
    typeof special?.value === "number"
      ? special.value
      : typeof fsp?.value === "number"
        ? fsp.value
        : null;
  if (!id || !title || !price || price <= 0) return null;

  const mrp =
    fsp && typeof fsp.value === "number" && fsp.value > price ? fsp.value : undefined;
  const discountPct = mrp
    ? Math.round(((mrp - price) / mrp) * 100)
    : undefined;

  const imageUrl = flipkartImage(value.media?.images?.[0]?.url);
  const productUrl = value.baseUrl
    ? new URL(value.baseUrl, "https://www.flipkart.com").toString()
    : "";
  if (!imageUrl || !productUrl) return null;

  const analytics = value.analyticsData ?? {};
  const ctx = [
    analytics.category ?? "",
    analytics.superCategory ?? "",
    analytics.subCategory ?? "",
    analytics.vertical ?? "",
  ].join(" ");

  return {
    id,
    store: "flipkart",
    title,
    brand:
      typeof value.titles?.superTitle === "string" && value.titles.superTitle
        ? value.titles.superTitle
        : undefined,
    price,
    mrp,
    discountPct,
    gender: inferGender(title, ctx),
    category: inferCategory(title),
    imageUrl,
    productUrl,
  };
}

/**
 * Walk a Flipkart `__INITIAL_STATE__` tree and pull every product node.
 * Order-preserving, deduplicated by product id.
 */
export function parseFlipkartState(state: unknown): Product[] {
  const products: Product[] = [];
  const seen = new Set<string>();
  const queue: unknown[] = [state];
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      for (const item of node) queue.push(item);
      continue;
    }
    const record = node as Record<string, unknown>;
    const value = (record.productInfo as { value?: FlipkartValue } | undefined)?.value;
    if (value && typeof value === "object") {
      const product = toProduct(value);
      if (product && !seen.has(product.id)) {
        seen.add(product.id);
        products.push(product);
      }
    }
    for (const key of Object.keys(record)) queue.push(record[key]);
  }
  return products;
}

/** Fetch a Flipkart search page and parse its product list. */
export async function searchFlipkart(q: string, page = 1): Promise<Product[]> {
  const res = await fetch(flipkartSearchUrl(q, page), {
    headers: {
      "user-agent": CHROME_UA,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-IN,en;q=0.9",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`flipkart search failed: ${res.status}`);
  const html = await res.text();
  return parseFlipkartState(
    extractJsonAfterMarker(html, "window.__INITIAL_STATE__ ="),
  );
}
