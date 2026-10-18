# Changelog

Release notes for TryMe, mirrored from the [GitHub Releases](https://github.com/dipandhali2021/tryme/releases) page.

## v0.1.1 — 2026-10-18

Search fixes — the gender chips refine the search, results paginate, and Myntra gets an honest fallback on the cloud.

### Fixed

- **Gender chips refine the search itself.** Picking Women (or Men) folds the facet into the store query — "shirt" + Women searches "women shirt" — instead of only filtering the loaded page. "shirt" alone is an all-men page from Flipkart, which is why Women used to show an empty grid.
- **Myntra on the hosted demo.** Myntra answers datacenter networks with a ~500-byte "Site Maintenance" decoy (verified from Vercel `bom1` and third-party fetchers), so its search can't run from the cloud. The studio now spots the refusal and shows an "Open Myntra search" panel with the drag-onto-studio flow — same pattern as Amazon — instead of a dead-end error. The crawler pass and `/gateway/v2/search` JSON fallback stay in place for networks where they answer; local sessions keep live Myntra search.

### Added

- **Load more** — paginates the current search, appends deduped products, and notes when the store runs out.

### Verified

- 172 unit tests, ESLint clean, `tsc --noEmit` clean.
- Prod pass on <https://tryme-rust.vercel.app>: "shirt" + Women chip shows women's shirts (was empty); Load more took 40 → 68 products; Myntra tab shows the fallback panel.

## v0.1.0 — 2026-10-18

Live virtual try-on. Turn on your camera, pick a garment from Amazon / Flipkart / Myntra (or drag in any image), and see it on you in real time with [Decart Lucy VTON](https://decart.ai) — every try capped at 20 seconds.

**Live demo:** <https://tryme-rust.vercel.app> — Vercel functions pinned to Mumbai (`bom1`) so the store scrapers have Indian egress.

### Highlights

#### Studio (`/studio`)

- **Live camera try-on** via Decart Lucy VTON (`fast` mode), one garment per try.
- **20-second cap per try** — warning at 5s, auto-stop at 0, then a recap card with a recorded replay of the try.
- **Pause** mid-try drops the billed stream instantly; resume with the seconds you had left.
- **Live-scraped garments** — search Flipkart and Myntra directly; filter by category, price, color, brand, gender, and sort.
- **Any garment, anywhere** — paste a product link, drag an image from another tab, paste an image URL, or upload a photo.
- Garment images proxied, allow-listed, and disk-cached through `/api/proxy-image`.

#### Landing (`/`)

- Minimal hero over a hills backdrop, source marquee, and a three-step how-it-works.
- Dark by default with a light toggle; the backdrop composes in both themes.
- Full mobile pass: 360–390px layouts, no horizontal overflow, tagged tap targets.

#### Plumbing

- Decart keys never reach the browser — short-lived client tokens are minted server-side (`/api/realtime-token`), scoped to the VTON model and the calling origin.
- **Multi-key fallback** — add `DECART_API_KEY_2`, `DECART_API_KEY_3`, … (or a comma list in `DECART_API_KEYS`) and an exhausted or rejected key falls through to the next automatically; a key that just failed is tried last for a minute so a dead primary costs nothing per session.
- Search results cached for 6 hours (negative results 2 minutes, stale-on-error fallback); images content-addressed under a gitignored `.cache/`.

### Verified

- 163 unit tests, ESLint clean, `tsc --noEmit` clean, production build green.
- Free test matrix (headless Chrome, fake camera): navigation and scroll behavior, camera states, search and filters, link/upload/drag imports, mobile layouts at 360/390px, both themes.
- Billed live rows of the full try-on checklist (`TESTING.md` T1–T8) remain pending a funded trial.

### Setup

```bash
npm install
cp .env.local.example .env.local   # paste your DECART_API_KEY (+_2, _3, …)
npm run dev                        # http://localhost:3000
```

- `npm test` — Vitest suite
- `npm run build` — production build
- Camera access needs a secure context: `localhost` counts, other hosts need HTTPS.

### Notes

- Amazon blocks server-side scraping — the studio offers a fallback panel that opens an Amazon search, then you drag any product image onto the studio.
- **Hosted demo:** Flipkart search, imports, and try-on all work; Myntra's live search is blocked by Myntra from cloud IPs (it works when you run locally). The demo runs on the owner's Decart key — try-ons spend credits.
- Scraping storefront HTML may conflict with the stores' terms of service — this is a personal demo; use official product APIs for anything real. Store names are trademarks of their respective owners.
