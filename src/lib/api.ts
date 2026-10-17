import type { SearchResponse } from "@/lib/stores/search";
import type { StoreId } from "@/lib/stores/types";

/** Client-side search call against our /api/search route. */
export async function fetchSearch(
  store: StoreId,
  q: string,
  page = 1,
): Promise<SearchResponse> {
  const res = await fetch(
    `/api/search?store=${store}&q=${encodeURIComponent(q)}&page=${page}`,
  );
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return (await res.json()) as SearchResponse;
}
