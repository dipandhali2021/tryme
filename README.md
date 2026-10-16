# TryMe

Live virtual try-on. Turn on your camera, pick a garment scraped from
Amazon / Flipkart / Myntra, and see it on you in real time via Decart.

## Setup

```bash
npm install
cp .env.local.example .env.local   # then paste your DECART_API_KEY
npm run dev
```

Open http://localhost:3000.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build
- `npm test` — unit tests (Vitest)

## How it works

- **Left half (/studio):** camera preview + Decart realtime try-on session.
- **Right half:** live-scraped garments with filters; one garment per try,
  capped at 20 seconds per try.
- Garment images are proxied and cached through `/api/proxy-image`
  (retailer CDNs only) and uploaded to Decart via `/api/upload-garment`.
- The Decart API key never leaves the server: the browser gets a short-lived
  realtime token from `/api/realtime-token`.

## Design docs

- `docs/superpowers/specs/2026-10-16-tryme-design.md`
- `docs/superpowers/plans/2026-10-16-tryme-v1.md`
