import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { StoreMarquee } from "@/components/landing/marquee";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="landing-backdrop absolute -top-[69px] bottom-0 left-0 right-0 z-0"
      />
      <div className="relative z-10 flex flex-1 flex-col">
        <section className="flex min-h-[calc(100svh-69px)] flex-col">
          <Hero />
          <StoreMarquee />
        </section>
        <HowItWorks />
        <footer className="mt-auto border-t border-border/50 bg-background/60 backdrop-blur-sm">
          <p className="mx-auto max-w-6xl px-s-6 py-s-3 text-center text-v-meta text-muted-foreground">
            Powered by Decart Lucy VTON · Works best on tops &amp; dresses ·
            Store names are trademarks of their owners.
          </p>
        </footer>
      </div>
    </main>
  );
}
