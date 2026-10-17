import { cacheGet, cacheSet } from "@/lib/stores/cache";
import {
  findStoreLink,
  storeFromHost,
  type ImportedGarment,
} from "@/lib/stores/link-url";
import type { StoreId } from "@/lib/stores/types";

/** A recognized problem with a pasted product link (shown to the user). */
export class ImportLinkError extends Error {}

const CHROME_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const TTL_HIT = 6 * 60 * 60 * 1000; // 6h — product pages change rarely
const MAX_HTML = 1_500_000; // og/JSON-LD data lives near the top

const ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  lt: "<",
  gt: ">",
  "#39": "'",
  "#x27": "'",
  "#x2f": "/",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(amp|quot|lt|gt|#39|#x27|#x2f);/gi,
    (match, code: string) => ENTITIES[code.toLowerCase()] ?? match,
  );
}

/** First `<meta>` content matching one of `keys`, either attribute order. */
function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const propertyFirst = new RegExp(
      `<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]*?content=["']([^"']*)["']`,
      "i",
    );
    const contentFirst = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name|itemprop)=["']${escaped}["']`,
      "i",
    );
    const match = html.match(propertyFirst) ?? html.match(contentFirst);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return null;
}

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Every JSON a `<script type="application/ld+json">` block holds. */
function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // truncated or malformed block — ignore it
    }
  }
  return blocks;
}

const NESTED_KEYS = ["@graph", "itemListElement", "item"];

/** Collect every `"@type": "Product"` node, wherever it is nested. */
function collectProducts(node: unknown, out: JsonRecord[], depth = 0): void {
  if (depth > 6) return;
  if (Array.isArray(node)) {
    for (const item of node) collectProducts(item, out, depth + 1);
    return;
  }
  if (!isRecord(node)) return;
  const type = node["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === "string" && t.toLowerCase() === "product")) {
    out.push(node);
  }
  for (const key of NESTED_KEYS) {
    if (key in node) collectProducts(node[key], out, depth + 1);
  }
}

function stringOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** `image` fields may be strings, arrays, or `{ url }` objects. */
function imageOf(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = imageOf(item);
      if (found) return found;
    }
    return null;
  }
  if (isRecord(value)) return imageOf(value.url ?? value.contentUrl ?? value["@id"]);
  return null;
}

function priceOf(offers: unknown): number | undefined {
  const list = Array.isArray(offers) ? offers : [offers];
  for (const offer of list) {
    if (!isRecord(offer)) continue;
    const raw = offer.price ?? offer.lowPrice;
    const price =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number.parseFloat(raw)
          : NaN;
    if (Number.isFinite(price) && price > 0) return Math.round(price);
  }
  return undefined;
}

function brandOf(product: JsonRecord | undefined): string | undefined {
  if (!product) return undefined;
  const brand = product.brand;
  if (typeof brand === "string") return stringOf(brand) ?? undefined;
  if (isRecord(brand)) return stringOf(brand.name) ?? undefined;
  return undefined;
}

function absoluteUrl(candidate: string | null, base: string): string | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.protocol = "https:"; // every store CDN is https; upgrade helps the proxy
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Pull a garment (image, title, brand, price) out of a product page.
 * `og:` meta tags win — they are the share image the store itself picked —
 * with JSON-LD as the fallback. Returns null when there is no usable image.
 */
export function parseGarmentHtml(
  html: string,
  store: StoreId,
  pageUrl: string,
): ImportedGarment | null {
  const products: JsonRecord[] = [];
  for (const block of jsonLdBlocks(html)) collectProducts(block, products);
  const product = products[0];

  const rawImage =
    metaContent(html, [
      "og:image:secure_url",
      "og:image",
      "twitter:image",
      "twitter:image:src",
    ]) ?? imageOf(product?.image);
  const imageUrl = absoluteUrl(rawImage, pageUrl);
  if (!imageUrl) return null;

  const rawTitle =
    stringOf(product?.name) ??
    metaContent(html, ["og:title", "twitter:title"]) ??
    stringOf(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null);
  const title = rawTitle?.replace(/\s+/g, " ").trim();
  if (!title) return null;

  const metaPrice = metaContent(html, ["og:price:amount", "product:price:amount"]);
  const parsedMetaPrice = metaPrice ? Number.parseFloat(metaPrice) : NaN;
  const price =
    priceOf(product?.offers) ??
    (Number.isFinite(parsedMetaPrice) && parsedMetaPrice > 0
      ? Math.round(parsedMetaPrice)
      : undefined);

  return {
    store,
    title: title.slice(0, 160),
    brand: brandOf(product),
    price,
    imageUrl,
    productUrl: pageUrl,
  };
}

/**
 * Fetch a product page and extract the garment it sells. Importing is free —
 * it is a plain page fetch, no AI involved. Trying the garment on stays an
 * explicit, user-clicked action.
 */
export async function importFromLink(raw: string): Promise<ImportedGarment> {
  const link = findStoreLink(raw);
  const store = link ? storeFromHost(link.hostname) : null;
  if (!link || !store) {
    throw new ImportLinkError(
      "That doesn't look like a product link. Paste an Amazon, Flipkart or Myntra product page — or upload a garment photo instead.",
    );
  }

  const cacheKey = `link:${link.toString()}`;
  const cached = cacheGet<ImportedGarment>(cacheKey, TTL_HIT);
  if (cached) return cached;

  let html: string;
  let finalUrl: string;
  try {
    const res = await fetch(link, {
      headers: {
        "user-agent": CHROME_UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-IN,en;q=0.9",
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    finalUrl = res.url || link.toString();
    html = (await res.text()).slice(0, MAX_HTML);
  } catch {
    throw new ImportLinkError(
      "That page wouldn't load. Check the link or try again — or upload a garment photo instead.",
    );
  }

  const garment = parseGarmentHtml(html, store, finalUrl);
  if (!garment) {
    throw new ImportLinkError(
      store === "amazon"
        ? "Amazon blocks server-side page reads. Open the product in a new tab and drag its photo onto this panel — or upload a photo instead."
        : "Couldn't find a garment photo on that page. Try a product page link — or upload a photo instead.",
    );
  }
  cacheSet(cacheKey, garment);
  return garment;
}
