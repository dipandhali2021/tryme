import type { SearchResponse } from "@/lib/stores/search";
import type { ImportedGarment } from "@/lib/stores/link-url";
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

/** Import a product link through our /api/import-link route (free — no AI). */
export async function importProductLink(url: string): Promise<ImportedGarment> {
  const res = await fetch(`/api/import-link?url=${encodeURIComponent(url)}`);
  const body = (await res.json().catch(() => null)) as
    | { garment?: ImportedGarment; error?: string }
    | null;
  if (!res.ok || !body?.garment) {
    throw new Error(body?.error ?? `Import failed (${res.status})`);
  }
  return body.garment;
}
