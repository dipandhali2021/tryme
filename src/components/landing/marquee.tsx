import { Marquee } from "@/components/ui/marquee";

const SOURCES = [
  { name: "Amazon", note: "drag & try" },
  { name: "Flipkart", note: "live search" },
  { name: "Myntra", note: "live search" },
  { name: "Your camera roll", note: "upload" },
  { name: "Any open tab", note: "drop it in" },
];

// One authored strip must outrun the viewport, or the track stretches and
// opens a bare gap at the wrap point between passes.
const TILES = [...SOURCES, ...SOURCES];

/** Store names drifting by — a hint at where garments come from. */
export function StoreMarquee() {
  return (
    <Marquee
      label="Where your next fit comes from"
      speed="normal"
      controls={false}
      className="mx-auto w-full max-w-6xl px-s-6 pb-s-5"
    >
      {TILES.map((source, index) => (
        <span
          key={`${source.name}-${index}`}
          className="inline-flex items-baseline gap-s-2 rounded-full border border-border bg-v-paper px-s-4 py-s-2 text-v-control"
        >
          <span className="font-weight-v-semibold">{source.name}</span>
          <span className="text-v-small text-muted-foreground">
            {source.note}
          </span>
        </span>
      ))}
    </Marquee>
  );
}
