import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-s-6 p-s-10 text-center">
      <h1 className="max-w-3xl font-heading text-v-hero font-weight-v-semibold tracking-tight">
        See it on you. Live.
      </h1>
      <p className="max-w-prose text-v-lead text-muted-foreground">
        Pick a garment from Amazon, Flipkart or Myntra, turn on your camera, and
        watch it land on you in real time.
      </p>
      <Button asChild size="lg">
        <Link href="/studio">Open the studio</Link>
      </Button>
    </main>
  );
}
