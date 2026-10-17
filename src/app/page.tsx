import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { StoreMarquee } from "@/components/landing/marquee";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <StoreMarquee />
      <HowItWorks />
      <footer className="mt-auto border-t border-border">
        <p className="mx-auto max-w-5xl px-s-6 py-s-6 text-center text-v-meta text-muted-foreground">
          Powered by Decart Lucy VTON · Works best on tops &amp; dresses · Store
          names are trademarks of their respective owners.
        </p>
      </footer>
    </main>
  );
}
