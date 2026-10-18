import { extractJsonAfterMarker } from "@/lib/stores/extract";
import { inferCategory, inferGender } from "@/lib/stores/normalize";
import type { Gender, Product } from "@/lib/stores/types";

/** Slug Myntra uses for search URLs: "Men's T-Shirts!" → "mens-t-shirts". */
export function myntraSlug(q: string): string {
  return q
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function myntraSearchUrl(q: string, page = 1): string {
  const url = `https://www.myntra.com/${myntraSlug(q)}`;
  return page > 1 ? `${url}?p=${page}` : url;
}

const GATEWAY_ROWS = 40;

/** The JSON gateway the Myntra web app itself calls for result pages. */
export function myntraGatewayUrl(q: string, page = 1): string {
  const offset = (page - 1) * GATEWAY_ROWS;
  return `https://www.myntra.com/gateway/v2/search/${myntraSlug(q)}?p=${page}&rows=${GATEWAY_ROWS}&o=${offset}&plaEnabled=false`;
}

/** Join a `Set-Cookie` list into a single Cookie request header. */
export function cookieHeader(setCookies: string[]): string {
  return setCookies
    .map((row) => row.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ");
}

const CHROME_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const GOOGLEBOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

/** Myntra refuses search pages to cloud networks (Akamai maintenance decoy). */
export class MyntraBlockedError extends Error {
  constructor(detail: string) {
    super(`myntra blocked: ${detail}`);
    this.name = "MyntraBlockedError";
  }
}

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

function productsFrom(entries: unknown[]): Product[] {
  const seen = new Set<string>();
  const products: Product[] = [];
  for (const item of entries) {
    const product = toProduct(item as MyntraValue);
    if (product && !seen.has(product.id)) {
      seen.add(product.id);
      products.push(product);
    }
  }
  return products;
}

/** Parse the `window.__myx` search payload into normalized products. */
export function parseMyntraState(state: unknown): Product[] {
  const record = state as {
    searchData?: { results?: { products?: unknown } };
  } | null;
  const raw = record?.searchData?.results?.products;
  return Array.isArray(raw) ? productsFrom(raw) : [];
}

/** Parse a `/gateway/v2/search` response body into normalized products. */
export function parseMyntraGateway(body: unknown): Product[] {
  const raw = (body as { products?: unknown } | null)?.products;
  return Array.isArray(raw) ? productsFrom(raw) : [];
}

/**
 * Fetch a Myntra search page. A normal browser session gets HTML with the
 * `window.__myx` payload; datacenter IPs (our Vercel functions) get a
 * stripped maintenance page instead — so we keep the Akamai cookies that
 * came with it, try once more as a crawler, then ask the JSON gateway that
 * the Myntra web app itself uses (it only answers with those cookies).
 * If even the gateway refuses, the IP itself is blocked: throw
 * `MyntraBlockedError` so the UI can offer the drag-in fallback.
 */
export async function searchMyntra(q: string, page = 1): Promise<Product[]> {
  const pageUrl = myntraSearchUrl(q, page);

  const first = await fetchSearchPage(pageUrl, CHROME_UA);
  if (first.products.length > 0) return first.products;

  const crawler = await fetchSearchPage(pageUrl, GOOGLEBOT_UA);
  if (crawler.products.length > 0) return crawler.products;

  const cookies = [...first.cookies, ...crawler.cookies];
  const gatewayRes = await fetch(myntraGatewayUrl(q, page), {
    headers: {
      "user-agent": CHROME_UA,
      accept: "application/json, text/plain, */*",
      "accept-language": "en-IN,en;q=0.9",
      referer: pageUrl,
      ...(cookies.length > 0 ? { cookie: cookieHeader(cookies) } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = gatewayRes.ok
    ? ((await gatewayRes.json().catch(() => null)) as unknown)
    : null;
  if (body !== null) return parseMyntraGateway(body);

  throw new MyntraBlockedError(
    `gateway ${gatewayRes.status}, page ${first.status}/${first.length}b`,
  );
}

/** One page visit: its status, cookies, size and any `__myx` products. */
async function fetchSearchPage(
  pageUrl: string,
  userAgent: string,
): Promise<{
  status: number | string;
  cookies: string[];
  length: number;
  products: Product[];
}> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "user-agent": userAgent,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-IN,en;q=0.9",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const cookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [];
    if (!res.ok) return { status: res.status, cookies, length: 0, products: [] };
    const html = await res.text();
    let products: Product[] = [];
    try {
      products = parseMyntraState(
        extractJsonAfterMarker(html, "window.__myx ="),
      );
    } catch {
      products = [];
    }
    return { status: res.status, cookies, length: html.length, products };
  } catch {
    return { status: "unreachable", cookies: [], length: 0, products: [] };
  }
}
