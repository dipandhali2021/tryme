"use client";

import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatClock } from "@/lib/format";
import { LIVE_SECONDS } from "@/lib/session/machine";
import { cn } from "@/lib/utils";

export type CountdownProps = {
  remaining: number;
  warn: boolean;
  className?: string;
};

/** The 20s-per-try clock: badge, thin progress bar, and a ⓘ explainer. */
export function Countdown({ remaining, warn, className }: CountdownProps) {
  return (
    <div
      className={cn(
        "flex w-64 flex-col gap-s-2 rounded-2xl bg-background/85 p-s-3 shadow-lg backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-s-2">
        <span className="flex items-center gap-s-2">
          <Badge
            variant={warn ? "danger" : "count"}
            className="tabular-nums"
            aria-live="polite"
          >
            {formatClock(remaining)}
          </Badge>
          <span className="text-v-small font-weight-v-medium text-muted-foreground">
            seconds left
          </span>
        </span>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="How the timer works"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Info className="size-4" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              20 sec per try. Pick another garment to restart.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Progress
        value={remaining}
        max={LIVE_SECONDS}
        appearance="line"
        className="h-1"
        data-warn={warn || undefined}
      />
    </div>
  );
}
