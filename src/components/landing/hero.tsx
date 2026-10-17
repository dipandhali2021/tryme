import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeroButton } from "@/components/ui/hero-button";
import { TextReveal } from "@/components/ui/text-reveal";

export function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-s-5 px-s-6 pb-s-10 pt-s-16 text-center">
      <Badge variant="pink-soft">Live virtual try-on</Badge>
      <TextReveal
        as="h1"
        text="Try clothes on. Before you buy."
        variant="rise"
        split="word"
        stagger={45}
        className="font-heading text-v-display font-weight-v-semibold tracking-tight text-balance md:text-v-hero"
      />
      <p className="max-w-2xl text-v-lead text-muted-foreground text-balance">
        Turn on the camera. Pick a fit from Amazon, Flipkart or Myntra. See it
        on you for 20 seconds.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-s-3 pt-s-2">
        <HeroButton asChild size="lg">
          <Link href="/studio">Open the fitting room</Link>
        </HeroButton>
        <Button asChild variant="ghost" size="lg">
          <Link href="#how">How it works</Link>
        </Button>
      </div>
    </section>
  );
}
