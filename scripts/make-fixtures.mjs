// Regenerates trimmed test fixtures from saved retailer HTML (or live fetch).
// Usage: node scripts/make-fixtures.mjs
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = "/tmp/opencode";

/** Brace-match the JSON object that follows `marker` in an HTML document. */
function extractJsonAfterMarker(html, marker) {
  const mi = html.indexOf(marker);
  if (mi === -1) throw new Error(`marker not found: ${marker}`);
  const start = html.indexOf("{", mi);
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let j = start; j < html.length; j++) {
    const c = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { end = j; break; } }
  }
  if (end === -1) throw new Error("unbalanced JSON");
  return JSON.parse(html.slice(start, end + 1));
}

/** Collect every `widget.data.products` array whose widget is a product list. */
function collectProducts(state) {
  const products = [];
  const seen = new Set();
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { for (const v of o) walk(v); return; }
    if (o.widget?.data?.products && Array.isArray(o.widget.data.products)) {
      for (const p of o.widget.data.products) {
        const id = p?.productInfo?.value?.id;
        if (id && !seen.has(id)) { seen.add(id); products.push(p); }
      }
    }
    for (const k of Object.keys(o)) walk(o[k]);
  })(state);
  return products;
}

const fkHtmlPath = join(CACHE, "fk.html");
if (!existsSync(fkHtmlPath)) throw new Error(`missing ${fkHtmlPath} — save a Flipkart search page there first`);
const fkState = extractJsonAfterMarker(readFileSync(fkHtmlPath, "utf8"), "window.__INITIAL_STATE__ =");
const fkProducts = collectProducts(fkState).slice(0, 20);
if (fkProducts.length < 20) throw new Error(`only ${fkProducts.length} flipkart products found`);

const fixture = {
  pageDataV4: {
    page: {
      data: {
        "10003": [
          { widget: { type: "PRODUCT_SUMMARY", data: { products: fkProducts } } },
        ],
      },
    },
  },
};
const outDir = join(root, "src/test/fixtures");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "flipkart-state.json"), JSON.stringify(fixture, null, 1));
console.log(`wrote ${fkProducts.length} flipkart products`);
