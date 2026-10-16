import { readFileSync } from "node:fs";
import { fetchAndCacheImage, isAllowedImageHost } from "@/lib/images/proxy";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url).searchParams.get("url");
  if (!url || !isAllowedImageHost(url)) {
    return new Response("url must be an allowlisted retailer image", {
      status: 400,
    });
  }

  const hit = await fetchAndCacheImage(url);
  if (hit) {
    const bytes = readFileSync(hit.path);
    return new Response(bytes, {
      headers: {
        "content-type": hit.contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  // Fetch failed (or CDN refused): let the browser load it directly.
  return Response.redirect(url, 302);
}
