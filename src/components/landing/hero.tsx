import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { HeroButton } from "@/components/ui/hero-button";
import { TextReveal } from "@/components/ui/text-reveal";

export function Hero() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-s-4 px-s-6 text-center">
      <Badge variant="pink-soft">Live virtual try-on</Badge>
      <TextReveal
        as="h1"
        text="Try clothes on. Before you buy."
        variant="rise"
        split="word"
        stagger={45}
        className="font-heading text-v-display font-weight-v-semibold tracking-tight text-balance xl:text-6xl"
      />
      <div className="flex flex-wrap items-center justify-center gap-s-5 pt-s-2">
        <HeroButton asChild size="lg">
          <Link href="/studio">Try it now</Link>
        </HeroButton>
      </div>
    </section>
  );
}
