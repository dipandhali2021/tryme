import type { Category, Gender } from "@/lib/stores/types";

/**
 * Parse an Indian price string into whole rupees.
 * "₹1,19,999" → 119999, "Free" → null.
 */
export function parseINR(raw: string): number | null {
  const cleaned = raw
    .replace(/₹|rs\.?|inr/gi, "")
    .replace(/[,\s]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

const topwear =
  /\b(?:tshirts?|shirts?|tees?|tops?|kurtas?|kurtis?|polos?|hoodies?|sweatshirts?|jackets?|sweaters?|blazers?|tunics?|blouses?)\b/;
const bottomwear =
  /\b(?:jeans?|trousers?|pants?|shorts?|skirts?|joggers?|leggings?|chinos?|cargos?|trackpants?)\b/;
const dress = /\b(?:dresses|dress|gowns?|jumpsuits?|rompers?|frocks?)\b/;
const footwear =
  /\b(?:shoes?|sneakers?|sandals?|heels?|flipflops?|loafers?|boots?|floaters?)\b/;
const accessory =
  /\b(?:bags?|handbags?|watches|watch|belts?|caps?|sunglasses|wallets?|backpacks?|scarves?|socks?|ties?)\b/;

/** Lowercased, hyphen-free title used for keyword matching. */
function plain(text: string): string {
  return text.toLowerCase().replace(/[-–—]/g, "");
}

export function inferCategory(title: string): Category {
  const text = plain(title);
  if (dress.test(text)) return "dress";
  if (footwear.test(text)) return "footwear";
  if (bottomwear.test(text)) return "bottomwear";
  if (topwear.test(text)) return "topwear";
  if (accessory.test(text)) return "accessory";
  return "other";
}

const women =
  /\b(?:women|womens|woman|womans|ladies|lady|female)\b/;
const men = /\b(?:men|mens|man|mans|male|gents?)\b/;
const kids =
  /\b(?:kids?|children|child|babies|baby|infants?|toddlers?|junior|boys?|girls?)\b/;
const unisex = /\bunisex\b/;

function matchGender(text: string): Gender | null {
  if (unisex.test(text)) return "unisex";
  if (kids.test(text)) return "kids";
  if (women.test(text)) return "women";
  if (men.test(text)) return "men";
  return null;
}

/**
 * Infer the shopper gender from the product title, falling back to page
 * context (e.g. the category the product was found under).
 */
export function inferGender(title: string, ctx?: string): Gender {
  const fromTitle = matchGender(plain(title));
  if (fromTitle) return fromTitle;
  if (ctx) {
    const fromCtx = matchGender(plain(ctx));
    if (fromCtx) return fromCtx;
  }
  return "unknown";
}
