# TryMe — Design

**Date:** 2026-10-16
**Status:** Approved in conversation (20-question Q&A, 4 batches)
**Next:** `docs/superpowers/plans/2026-10-16-tryme-v1.md`

## Intent

A website where, **before buying**, you turn on your camera, pick (or drag) a
clothing item, and see it on yourself live. Powered by Decart's realtime
virtual try-on model. Named **TryMe**.

Recon done before writing this: the Anywear Chrome extension (Decart's own)
was downloaded, unpacked and studied — its feature set, session/billing model,
reliability patterns and copy informed this design.

## Goals

- Landing page → studio. Studio: **50/50 split** — left = live camera mirror,
  right = live clothes panel.
- Right panel: store tabs (**Amazon / Flipkart / Myntra**), search, and
  filters: category, price range, color, brand, gender, sorting. Product
  cards with price/discount, image, and a link back to the real store page.
- **Live scraping** of the 3 stores server-side (user's choice; not a
  curated catalog), with a disk cache so repeat searches are fast and polite.
- Garment images proxied + cached through our server (their CDNs block
  hotlinking sometimes).
- Try flow: click a garment → it goes on you live. **20 seconds per try**
  (`lucy-vton-latest`, **fast mode**).
- Countdown **starts when the first AI frame appears** (warm-up is free) and
  **restarts each time a new garment is picked** (mirrors Anywear's
  per-garment clock). Warning at 5s, auto-disconnect at 0 (saves credits).
- After each try: recap card — replay the recorded try, Save clip, Try Again.
- Bonus (cheap, mirrors Anywear's superpower): drag any garment image from
  anywhere / paste image URL / upload a photo as extra input, in addition to
  the store catalog.
- Theme: dark studio default + light toggle. Sleek minimal aesthetic.
- V1 win condition: **works on the user's machine** (localhost demo).

## Non-goals (v1)

- Accounts, auth, payments, try-on credits.
- Public deployment hardening / rate limiting.
- Chrome extension, per-site try-on button injection.
- Official affiliate APIs (plain links only).
- Mobile-first design (desktop-first; won't be broken on mobile).

## Anti-goals

- Anything that leaks `DECART_API_KEY` to the browser.
- A countdown that steals warm-up time or lets a session run past 20s of
  streaming unnoticed.
- Scraping that hammers the stores (no cache, parallel floods).
- UI that buries the camera — the mirror is the product.

## Stack & constraints

- Next.js (App Router) + TypeScript + Tailwind CSS v4, shadcn CLI init.
- **Cojeev UI** (https://cojeev.com/ui/docs/) components & aesthetic:
  install via `npx shadcn@latest add https://cojeev.com/ui/r/<name>.json`.
  Sleek minimal; Cojeev motion presets (default "Glide"); fonts that ship
  with the components; light/dark via `data-mode` on `<html>`.
- `@decartai/sdk`: model `models.realtime("lucy-vton-latest")`, fast mode at
  connect (`speed: "fast"`), video-only getUserMedia at the model's
  fps/width/height.
- Token flow: `POST /api/realtime-token` (server) →
  `client.tokens.create({ expiresIn: 300, allowedModels: ["lucy-vton-3.6"],
  allowedOrigins: [origin] })` → `{ apiKey }` to browser. Browser client uses
  `apiKeyProvider`.
- Scrapers: one adapter per store; Flipkart + Myntra parse embedded JSON in
  search HTML (`window.__INITIAL_STATE__` / `window.__myx`); **Amazon search
  is bot-blocked** (verified: captcha stub from this machine) → Amazon tab
  shows a fallback: "Open Amazon search" + drag/paste any product image
  (which the drag-anywhere feature already supports).
- Feasibility verified live: Flipkart HTML 1.2MB with 130 product links +
  `__INITIAL_STATE__`; Myntra HTML 1.2MB with `__myx` searchData (titles,
  prices, ids, filters); Flipkart CDN image fetch 200 OK.
- Cache: disk JSON under `.cache/` (search TTL 6h, negative TTL 2min, images
  cached forever by sha1). gitignored.
- Currency INR; desktop-first; no analytics in v1.
- Costs: fast mode $0.04/s → a 20s try ≈ $0.80. User has an API key with
  credits; key lives in `.env.local` as `DECART_API_KEY`.

## Architecture (files)

```
src/
  app/                layout.tsx page.tsx (landing) studio/page.tsx
                      api/realtime-token/route.ts
                      api/search/route.ts
                      api/proxy-image/route.ts
  components/ui/      Cojeev/shadcn generated components
  components/landing/ hero, marquee, bento how-it-works
  components/studio/  camera-stage, countdown, recap-card, store-panel,
                      store-tabs, filter-bar, product-card, drop-zone
  lib/decart/         use-tryon-session.ts (client hook), client-token.ts (server)
  lib/stores/         types.ts, normalize.ts, cache.ts, filter.ts,
                      flipkart.ts, myntra.ts, amazon.ts, search.ts
  lib/images/         proxy.ts
  lib/session/        machine.ts (pure reducer, unit-tested)
  test/               vitest specs + trimmed scrape fixtures
```

## Session flow (state machine)

`camera_off → camera_ready → connecting → warming → live → ending → recap → camera_ready…`

- `LIVE_SECONDS = 20`, warn at `remaining <= 5`.
- Connect happens on first garment pick (not when camera turns on) — the
  preview is free, credits only burn during a try.
- `GARMENT_SELECTED` while `live` restarts `remaining` to 20.
- Expiry → auto `disconnect()` → recap (recorded clip ready).
- Errors (token, connect, mid-session disconnect, moderation "not supported")
  → clean end → visible message + Try again; never a stuck countdown.

## Review focus (most likely things to bite)

1. Camera/mic denied or missing → clear state + retry, no crash.
2. Token/connect failure or mid-session drop → clean end, fresh 20s on retry.
3. Scraper markup drift / Amazon block → per-store error + fallback, no
   crash; cached results still served.
4. Image CDN blocks our proxy → fall back to serving the direct URL so cards
   still render.
5. Fast garment switching during live + expiry mid-request → deterministic,
   no double-connect, no orphaned countdown.

## Builder latitude (decided during build, not by user)

- Exact Cojeev component list and motion settings; countdown visual (pill +
  progress bar under camera header).
- Scraper selector/JSON-path details against the saved fixtures.
- VTON prompt text (start with image-only; add text prompt only if needed).
- WebM duration quirk fix for the recap player (Anywear documents the
  MediaRecorder `duration: Infinity` trap — replicate the fix).
- Vitest for pure modules; UI verified by `next build` + manual checklist
  (documented in README).
