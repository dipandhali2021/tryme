"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroButton } from "@/components/ui/hero-button";
import { prepareRecap, recapFileName } from "@/lib/decart/recorder";

export type RecapCardProps = {
  url: string;
  onTryAgain: () => void;
  onAddAnother: () => void;
};

/**
 * Post-try overlay: the recorded AI stream looping with a working scrub bar,
 * plus Try again / Save clip / Add another garment.
 */
export function RecapCard({ url, onTryAgain, onAddAnother }: RecapCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fileName] = useState(() => recapFileName(new Date()));

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const cancel = prepareRecap(el, url);
    void el.play().catch(() => {});
    return cancel;
  }, [url]);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-s-5 backdrop-blur-sm">
      <div className="flex w-full max-w-lg flex-col gap-s-3 rounded-3xl bg-background/95 p-s-4 text-foreground shadow-2xl">
        <video
          ref={videoRef}
          controls
          loop
          playsInline
          muted
          className="aspect-video w-full rounded-2xl bg-black"
        />
        <p className="text-v-small text-muted-foreground">
          Replay your 20 seconds — save it, or give it one more go.
        </p>
        <div className="flex flex-wrap items-center gap-s-2">
          <HeroButton size="sm" showArrow={false} onClick={onTryAgain}>
            Try again
          </HeroButton>
          <Button asChild variant="secondary" size="sm">
            <a href={url} download={fileName}>
              <Download className="size-4" aria-hidden />
              Save clip
            </a>
          </Button>
          <Button variant="ghost" size="sm" onClick={onAddAnother}>
            Add another garment
          </Button>
        </div>
      </div>
    </div>
  );
}
