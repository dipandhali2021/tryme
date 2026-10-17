# TryMe

Live virtual try-on. Turn on your camera, pick a garment scraped from
Amazon / Flipkart / Myntra, and see it on you in real time via
[Decart Lucy VTON](https://decart.ai).

- **Landing** (`/`) — what it is, how it works.
- **Studio** (`/studio`) — camera on the left, live garments on the right.

## Setup

```bash
npm install
cp .env.local.example .env.local   # then paste your DECART_API_KEY
npm run dev
```

Running out of credits? Add `DECART_API_KEY_2`, `DECART_API_KEY_3`, … (or a
comma/space separated list in `DECART_API_KEYS`) — when a key is exhausted or
rejected, `/api/realtime-token` falls through to the next one automatically.

Open http://localhost:3000. Camera access needs a secure context: `localhost`
counts, other hosts need HTTPS.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (`npm start` to serve it)
- `npm test` — unit tests (Vitest)
- `npm run lint` — ESLint

## How it works

- **Left half:** camera preview + the Decart realtime session. One garment per
  try, capped at **20 seconds per try** — a warning drops at 5s, the session
  auto-stops at 0, and a recap with a recorded replay appears. Pause mid-try to
  drop the billed stream instantly and resume with the seconds you had left.
- **Right half:** live-scraped garments with filters (category, price, color,
  brand, gender, sort). Pick a garment and it lands on you — or paste a product
  link (Flipkart/Myntra; Amazon links get the drag-it-in fallback).
- **Any garment, anywhere:** drag an image from any open tab, paste an image
  URL, or upload a photo from your device.
- The Decart API key never leaves the server: the browser gets a short-lived
  client token from `/api/realtime-token`.
- Garment images are proxied, allow-listed, and disk-cached through
  `/api/proxy-image`; the browser then uploads bytes to Decart directly.

## Cost

The session runs in Decart's `fast` mode: roughly **$0.80 per 20-second try**
(2× speed costs 2×). The clock only starts when the first AI frame lands, and
a 20s try is the maximum — stopping early costs proportionally less. At the
current VTON pricing (2 credits/s, fast = 4 credits/s) a 1000-credit balance
is about **12 full tries**.

## Scraping notes

- **Flipkart** — parsed from `window.__INITIAL_STATE__` in the search HTML.
- **Myntra** — parsed from `window.__myx` (`searchData.results.products`).
- **Amazon** — blocks server-side scraping. TryMe shows a fallback panel that
  opens the Amazon search in a new tab; drag any product image from that tab
  onto the studio (or paste the image URL) to try it on.
- Search results are cached for 6 hours (negative results 2 minutes, with
  stale-on-error fallback); images are content-addressed under `.cache/`
  (gitignored). Delete `.cache/` to start fresh.

## Troubleshooting

- **Camera says denied** — allow camera access for `localhost` in your
  browser's site settings, then reload. Video-only: no microphone is ever
  requested.
- **"Could not get a session token"** — `DECART_API_KEY` is missing or
  invalid in `.env.local` (restart the dev server after editing it).
- **First AI connection is slow** — on networks that black-hole IPv6, Node's
  happy-eyeballs can stall first connections. The `dev`/`start` scripts pass
  `--no-network-family-autoselection` and `src/instrumentation.ts` sets the
  same default server-side; if you launch Next directly, set
  `NODE_OPTIONS=--no-network-family-autoselection` yourself.
- **Try-on connects but no AI frames** — check the browser console for
  WebRTC errors; corporate VPNs/firewalls can block UDP.

## Legal

This is a personal/local demo. Scraping storefront HTML may conflict with the
stores' terms of service — use official product APIs for anything real. Store
names are trademarks of their respective owners. Decart provides the try-on
model; see decart.ai for their terms.

## Design docs

- `docs/superpowers/specs/2026-10-16-tryme-design.md`
- `docs/superpowers/plans/2026-10-16-tryme-v1.md`
