import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { cacheFile } from "@/lib/stores/cache";

/**
 * Retailer image CDNs we are willing to proxy. Both the historical
 * (rukmini1) and current (rukminim2) Flipkart hosts are live, so both are
 * listed. Matched as hostname suffixes only.
 */
export const IMAGE_HOST_SUFFIXES = [
  "rukmini1.flixcart.com",
  "rukmini2.flixcart.com",
  "rukminim1.flixcart.com",
  "rukminim2.flixcart.com",
  "assets.myntassets.com",
  "constant.myntassets.com",
  "m.media-amazon.com",
];

/** True when the URL's hostname is (or is a subdomain of) an allowed CDN. */
export function isAllowedImageHost(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  return IMAGE_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

/** Some CDNs require a same-site referer to serve full-size images. */
export function refererFor(raw: string): string | null {
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host.endsWith("flixcart.com")) return "https://www.flipkart.com/";
  if (host.endsWith("myntassets.com")) return "https://www.myntra.com/";
  if (host.endsWith("media-amazon.com")) return "https://www.amazon.in/";
  return null;
}

const CHROME_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export type CachedImage = { path: string; contentType: string };

/**
 * Download an allowlisted image into the disk cache (sha1-keyed).
 * Returns null when the host is not allowed, the fetch fails, or the
 * response is not an image — callers fall back to a redirect.
 */
export async function fetchAndCacheImage(
  url: string,
): Promise<CachedImage | null> {
  if (!isAllowedImageHost(url)) return null;

  const path = cacheFile("images", url);
  const metaPath = `${path}.meta`;

  try {
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
      contentType?: string;
    };
    const stat = statSync(path);
    if (meta.contentType && stat.size > 0) {
      return { path, contentType: meta.contentType };
    }
  } catch {
    // cache miss — fall through to fetch
  }

  const referer = refererFor(url);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "user-agent": CHROME_UA,
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "accept-language": "en-IN,en;q=0.9",
        ...(referer ? { referer } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) return null;

  try {
    const bytes = Buffer.from(await res.arrayBuffer());
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
    writeFileSync(metaPath, JSON.stringify({ contentType, url, t: Date.now() }));
    return { path, contentType };
  } catch {
    return null;
  }
}
