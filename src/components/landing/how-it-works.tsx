import { ShoppingBag, Timer, Video } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STEPS = [
  {
    id: "camera",
    number: "01",
    icon: Video,
    title: "Turn on camera",
    body: "Nothing stored, nothing uploaded.",
    tone: "pink",
  },
  {
    id: "pick",
    number: "02",
    icon: ShoppingBag,
    title: "Pick a fit",
    body: "Live results from Amazon, Flipkart, Myntra.",
    tone: "yellow",
  },
  {
    id: "twenty",
    number: "03",
    icon: Timer,
    title: "20 seconds",
    body: "It's on you. Then it's gone.",
    tone: "blue",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how"
      className="mx-auto w-full max-w-6xl px-s-6 pt-s-10 pb-s-8"
    >
      <h2 className="mb-s-4 text-v-section font-weight-v-semibold">
        How it works
      </h2>
      <ul className="grid w-full grid-cols-1 gap-s-4 sm:grid-cols-3">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.id} className="min-w-0">
              <Card variant={step.tone} lift className="h-full text-left">
                <CardHeader>
                  <span className="text-v-meta tabular-nums opacity-70">
                    {step.number}
                  </span>
                  <Icon className="size-5 opacity-70" aria-hidden />
                </CardHeader>
                <CardContent>
                  <CardTitle>{step.title}</CardTitle>
                  <CardDescription>{step.body}</CardDescription>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
