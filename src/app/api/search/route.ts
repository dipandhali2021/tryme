import { isStoreId, searchStore } from "@/lib/stores/search";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const store = url.searchParams.get("store") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim();
  const pageRaw = Number(url.searchParams.get("page") ?? "1");
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  if (!isStoreId(store)) {
    return Response.json({ error: "unknown store" }, { status: 400 });
  }
  if (!q || q.length > 100) {
    return Response.json(
      { error: "query must be 1-100 characters" },
      { status: 400 },
    );
  }

  const result = await searchStore(store, q, page);
  return Response.json(result);
}
