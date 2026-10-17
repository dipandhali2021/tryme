import type { StoreId } from "@/lib/stores/types";

/** A garment pulled from a pasted product-page link. */
export type ImportedGarment = {
  store: StoreId;
  title: string;
  brand?: string;
  price?: number;
  imageUrl: string;
  productUrl: string;
};

/** Map a hostname to its store. Also covers the share-link hosts. */
export function storeFromHost(hostname: string): StoreId | null {
  const host = hostname.toLowerCase();
  if (host === "amzn.to" || host === "amzn.in" || host === "a.co") return "amazon";
  if (/(^|\.)amazon\.[a-z]{2,3}(\.[a-z]{2,3})?$/.test(host)) return "amazon";
  if (host === "fkrt.it" || /(^|\.)flipkart\.com$/.test(host)) return "flipkart";
  if (host === "myntr.it" || /(^|\.)myntra\.com$/.test(host)) return "myntra";
  return null;
}

/**
 * Find the first token in `text` that parses as a link to a supported store.
 * Scheme-less pastes ("www.flipkart.com/x") are accepted, and trailing
 * punctuation ("…itm123).") is trimmed.
 */
export function findStoreLink(text: string): URL | null {
  for (const token of text.split(/\s+/)) {
    const cleaned = token
      .replace(/^[([{<"'’]+/, "")
      .replace(/[)\]}>"',;.!…]+$/, "");
    if (!cleaned) continue;
    const candidate = /^https?:\/\//i.test(cleaned)
      ? cleaned
      : `https://${cleaned}`;
    try {
      const url = new URL(candidate);
      if (storeFromHost(url.hostname)) return url;
    } catch {
      // not a URL — keep scanning
    }
  }
  return null;
}

/** True when pasted or dropped text carries an Amazon / Flipkart / Myntra link. */
export function looksLikeStoreLink(text: string): boolean {
  return findStoreLink(text) !== null;
}
