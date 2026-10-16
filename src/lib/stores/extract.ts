/**
 * Extract the JSON object that follows `marker` in an HTML document.
 * String-aware brace matching: braces inside string literals are ignored.
 */
export function extractJsonAfterMarker(html: string, marker: string): unknown {
  const mi = html.indexOf(marker);
  if (mi === -1) throw new Error(`marker not found: ${marker}`);
  const start = html.indexOf("{", mi);
  if (start === -1) throw new Error("no JSON object after marker");
  let depth = 0;
  let end = -1;
  let inStr = false;
  let esc = false;
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
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = j;
        break;
      }
    }
  }
  if (end === -1) throw new Error("unbalanced JSON in document");
  return JSON.parse(html.slice(start, end + 1));
}
