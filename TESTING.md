# Manual test checklist

Local, in-browser verification of TryMe. Run `npm run dev` and open
http://localhost:3000. Camera tests need a real (or fake) video device.

Record the outcome per line: **PASS**, **FAIL**, or **SKIP (reason)**.

| # | Check | How | Result |
|---|-------|-----|--------|
| | **Landing** | | |
| L1 | Landing renders | Open `/` — headline, three steps, footer visible | PASS |
| L2 | CTA goes to studio | Click "Open the fitting room →" | PASS |
| L3 | Store marquee animates | Names drift; pause control works | PASS — "Moving" → pause → "Paused" → resume |
| L4 | Theme toggle | Toggle light/dark on `/`; header toggle reflects mode; reload keeps it | PASS — reload keeps light; switch `aria-checked` flips |
| | **Camera** | | |
| C1 | Grant permission | Click "Turn on camera" → preview appears | PASS — 1280×720 preview live (fake device, headless Chrome) |
| C2 | Deny permission | Deny in browser prompt → readable error, "Try again" path, no crash | PASS (app path) — "That did not work" + permission copy; retry recovers. Verified with an injected `NotAllowedError`; headless can't render a real prompt — worth one manual re-check |
| C3 | Camera off | "Stop" turns the camera off, preview gone | PASS — tracks end (`readyState: ended`), preview hidden |
| | **Search + filters** | | |
| S1 | Flipkart search | Search "black t-shirt" → products load with images | PASS — 39 items, proxied images |
| S2 | Myntra search | Switch tab, same query → products load | PASS — 32 items (myntassets images) |
| S3 | Amazon fallback | Switch tab → blocked notice + "open Amazon search" link | PASS — notice + link carries the query |
| S4 | Filters | Category, price, color, brand, gender narrow the grid | PASS — brand 39→7; gender → empty state + reset; price max ₹500 → 30 items (all ≤ ₹500); category + color selects drive the facets (color stayed "Black" for a black-tee query) |
| S5 | Sort | Each sort option reorders the grid | PASS — Price ↑ ascending, Price ↓ descending, Discount non-increasing, Relevance reorders |
| S6 | Product images | All thumbnails render (proxied via `/api/proxy-image`) | PASS — 39/39 loaded after a full scroll |
| | **Sourcing a garment** | | |
| G1 | Try from card | Click a card → garment pinned → "Try it on" starts a session | PASS (free part) — cards show title/brand/price/strike + "Try on" + open-in-store link. Card-click no longer pins; pinning is for pasted/uploaded/dropped sources. Session-start click pending live trial |
| G2 | Paste image URL | Copy an image URL anywhere → paste in studio → pinned card | PASS — pinned card "From the web" |
| G3 | Upload a file | Upload a local photo → pinned card | PASS — pinned card "From your device" (blob preview) |
| G4 | Drag from any tab | Drag a product image from an open tab → overlay appears → dropping pins it | PASS — full-screen "Drop it. It's yours in 20 seconds." → drop pins |
| | **Live try (20s cap)** | | |
| T1 | Connect + first frame | After "Try it on": connecting → first AI frame → clock starts on the frame | pending live trial |
| T2 | Countdown warn | Counter turns red/warns at 5s left | pending live trial |
| T3 | Auto-stop | At 0s the session ends by itself | pending live trial |
| T4 | Recap replay | Recap card shows a looping replay with a working scrub bar (~session length) | pending live trial |
| T5 | Save clip | "Save clip" downloads `tryme-*.webm` that plays locally | pending live trial |
| T6 | Try again | Button starts a fresh session | pending live trial |
| T7 | Garment switch | Picking another garment mid-session swaps it and restarts the clock | pending live trial |
| T8 | One garment per try | Only one garment applies per session (no stacking) | pending live trial |
| | **Polish** | | |
| P1 | Dark is default | Fresh profile opens in dark mode | PASS |
| P2 | Light mode | Toggle works on `/studio`; contrast holds (text readable, overlays dark) | PASS — light bg / white cards / dark text; toggles back to dark |
| P3 | Narrow width | ~900px wide: panes stack/remain usable, no horizontal scroll | PASS — camera stacks above the panel, scrollWidth == clientWidth |
| P4 | Reduced motion | `prefers-reduced-motion` disables the marquee/text reveals | PASS — marquee "Motion is off", pause button disabled |

## Notes

- Results above were executed 2026-10-17 against `npm run dev` in headless
  Chrome (fake camera device) with `npm test` / `npx tsc --noEmit` /
  `npm run build` / `npm run lint` all green.
- Live tries cost money (fast mode ≈ $0.80 / 20s). Everything except T1–T8 is
  free to run repeatedly.
- The pause button (drop the billed stream mid-try, resume with the banked
  seconds) is newer than this list; it is unit-tested, and its billing behavior
  needs one live trial.
- Camera without a real webcam: Chrome flags
  `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`.
