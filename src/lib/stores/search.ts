import { amazonFallback } from "@/lib/stores/amazon";
import { cacheGet, cacheSet } from "@/lib/stores/cache";
import { searchFlipkart } from "@/lib/stores/flipkart";
import { searchMyntra } from "@/lib/stores/myntra";
import type { Product, StoreId } from "@/lib/stores/types";

export type SearchResponse = {
  store: StoreId;
  q: string;
  page: number;
  products: Product[];
  cached: boolean;
  fetchedAt: number;
  blocked?: boolean;
  fallbackSearchUrl?: string;
  error?: string;
};

const TTL_HIT = 6 * 60 * 60 * 1000; // 6h
const TTL_NEGATIVE = 2 * 60 * 1000; // 2min

const adapters: Record<
  Exclude<StoreId, "amazon">,
  (q: string, page: number) => Promise<Product[]>
> = {
  flipkart: searchFlipkart,
  myntra: searchMyntra,
};

export const STORE_IDS: StoreId[] = ["amazon", "flipkart", "myntra"];

export function isStoreId(value: string): value is StoreId {
  return (STORE_IDS as string[]).includes(value);
}

/**
 * Search one store with a 6h disk cache, stale-on-error fallback and a
 * 2min negative cache so a blocked scraper doesn't get hammered.
 */
export async function searchStore(
  store: StoreId,
  q: string,
  page = 1,
): Promise<SearchResponse> {
  if (store === "amazon") {
    const { fallbackSearchUrl } = amazonFallback(q);
    return {
      store,
      q,
      page,
      products: [],
      cached: false,
      fetchedAt: Date.now(),
      blocked: true,
      fallbackSearchUrl,
    };
  }

  const key = `search:${store}:${q}:${page}`;

  const fresh = cacheGet<SearchResponse>(key, TTL_HIT);
  if (fresh) return { ...fresh, cached: true };

  const negative = cacheGet<SearchResponse>(`neg:${key}`, TTL_NEGATIVE);
  if (negative) return { ...negative, cached: true };

  try {
    const products = await adapters[store](q, page);
    const response: SearchResponse = {
      store,
      q,
      page,
      products,
      cached: false,
      fetchedAt: Date.now(),
    };
    cacheSet(key, response);
    return response;
  } catch (err) {
    // Serve the last good page for this query if one exists, even expired.
    const stale = cacheGet<SearchResponse>(key, Number.POSITIVE_INFINITY);
    if (stale) return { ...stale, cached: true };

    const response: SearchResponse = {
      store,
      q,
      page,
      products: [],
      cached: false,
      fetchedAt: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    };
    cacheSet(`neg:${key}`, response);
    return response;
  }
}
