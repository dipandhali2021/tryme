/**
 * Amazon.in blocks server-side scraping from many networks (captcha stub).
 * We don't fake it: the UI shows an "Open Amazon search" link plus
 * drag/paste/upload of a garment image instead.
 */
export function amazonFallback(q: string): {
  blocked: true;
  fallbackSearchUrl: string;
} {
  return {
    blocked: true,
    fallbackSearchUrl: `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
  };
}
