"use client";

import { ShoppingBag, Timer, Video } from "lucide-react";
import { BentoGrid } from "@/components/ui/bento-grid";
import type { BentoLayout } from "@/lib/cojeev/bento-layout";

const STEPS = [
  {
    id: "camera",
    number: "01",
    icon: Video,
    title: "Turn on camera",
    body: "Your browser, your room, nothing stored.",
  },
  {
    id: "pick",
    number: "02",
    icon: ShoppingBag,
    title: "Pick a fit",
    body: "Live results from three stores — filter by price, color, brand.",
  },
  {
    id: "twenty",
    number: "03",
    icon: Timer,
    title: "20 seconds",
    body: "It's on you. Then it's gone.",
  },
] as const;

const layout: BentoLayout = {
  columns: 4,
  rows: 2,
  seed: 7,
  tiles: [
    { id: "camera", x: 0, y: 0, width: 2, height: 2, label: "Turn on camera" },
    { id: "pick", x: 2, y: 0, width: 2, height: 1, label: "Pick a fit" },
    { id: "twenty", x: 2, y: 1, width: 2, height: 1, label: "20 seconds" },
  ],
};

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-5xl px-s-6 py-s-12">
      <h2 className="mb-s-6 text-v-section font-weight-v-semibold">
        How it works
      </h2>
      <BentoGrid
        layout={layout}
        variant="classic"
        renderTile={(tile) => {
          const step = STEPS.find((entry) => entry.id === tile.id) ?? STEPS[0];
          const Icon = step.icon;
          return (
            <div className="flex h-full flex-col justify-between gap-s-4 p-s-5">
              <div className="flex items-center justify-between">
                <span className="text-v-meta tabular-nums opacity-70">
                  {step.number}
                </span>
                <Icon className="size-5 opacity-70" aria-hidden />
              </div>
              <div className="flex flex-col gap-s-1">
                <span className="text-v-title font-weight-v-semibold">
                  {step.title}
                </span>
                <span className="text-v-small opacity-70">{step.body}</span>
              </div>
            </div>
          );
        }}
      />
    </section>
  );
}
