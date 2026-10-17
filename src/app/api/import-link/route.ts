import { ImportLinkError, importFromLink } from "@/lib/stores/link";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = (url.searchParams.get("url") ?? "").trim();

  if (!target || target.length > 500) {
    return Response.json({ error: "Paste a product link first." }, { status: 400 });
  }

  try {
    const garment = await importFromLink(target);
    return Response.json({ garment });
  } catch (error) {
    if (error instanceof ImportLinkError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return Response.json(
      { error: "Couldn't read that link. Try again, or upload a garment photo instead." },
      { status: 502 },
    );
  }
}
