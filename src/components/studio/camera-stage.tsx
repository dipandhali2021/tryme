"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { VideoOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeroButton } from "@/components/ui/hero-button";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Countdown } from "@/components/studio/countdown";
import { RecapCard } from "@/components/studio/recap-card";
import type { SessionState } from "@/lib/session/machine";
import { cn } from "@/lib/utils";

export type CameraStageProps = {
  state: SessionState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  recapUrl: string | null;
  onEnableCamera: () => void;
  onDisableCamera: () => void;
  onTryExample: () => void;
  onTryAgain: () => void;
  onDismissRecap: () => void;
  onPause: () => void;
  onResume: () => void;
  onEndTry: () => void;
  onRemoteFrame: () => void;
};

const PHASE_LABEL: Record<SessionState["phase"], string> = {
  camera_off: "Camera off",
  camera_ready: "Ready",
  connecting: "Connecting…",
  warming: "Warming up…",
  live: "On you",
  paused: "Paused",
  ending: "Wrapping up…",
  recap: "Ended",
  error: "Error",
};

/** How the camera frame maps into the stage: cover (Fill) or contain (Fit). */
type FitMode = "fill" | "fit";
const FIT_KEY = "tryme-cam-fit";
const fitListeners = new Set<() => void>();

function subscribeFit(listener: () => void): () => void {
  fitListeners.add(listener);
  return () => {
    fitListeners.delete(listener);
  };
}

function readFit(): FitMode {
  try {
    return window.localStorage.getItem(FIT_KEY) === "fit" ? "fit" : "fill";
  } catch {
    return "fill";
  }
}

function chooseFit(mode: FitMode): void {
  try {
    window.localStorage.setItem(FIT_KEY, mode);
  } catch {
    // storage unavailable — the choice still applies for this session
  }
  for (const listener of fitListeners) listener();
}

/**
 * The left half of the studio: a full-bleed camera stage, status badge, the
 * 20s countdown overlay, a Fill/Fit framing toggle, and the try controls.
 */
export function CameraStage({
  state,
  localStream,
  remoteStream,
  recapUrl,
  onEnableCamera,
  onDisableCamera,
  onTryExample,
  onTryAgain,
  onDismissRecap,
  onPause,
  onResume,
  onEndTry,
  onRemoteFrame,
}: CameraStageProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  // Mirrors localStorage without a hydration mismatch: the server snapshot is
  // the Fill default; the client re-reads right after hydration.
  const fit = useSyncExternalStore<FitMode>(subscribeFit, readFit, () => "fill");

  useEffect(() => {
    const el = localVideoRef.current;
    if (el && localStream && el.srcObject !== localStream) {
      el.srcObject = localStream;
    }
  }, [localStream]);

  // First presented AI frame — the moment the 20s clock may start.
  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el || !remoteStream) return;
    el.srcObject = remoteStream;
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      onRemoteFrame();
    };
    // "Try again" reuses this already-playing element, so the event may have
    // fired before this effect ran (or never fire again). Cover every case:
    // already painting → fire now; otherwise next frame / play event.
    if (!el.paused && el.readyState >= 2) {
      fire();
      return;
    }
    el.addEventListener("playing", fire);
    el.addEventListener("loadeddata", fire);
    let frameRequest = 0;
    if (typeof el.requestVideoFrameCallback === "function") {
      frameRequest = el.requestVideoFrameCallback(() => fire());
    }
    return () => {
      el.removeEventListener("playing", fire);
      el.removeEventListener("loadeddata", fire);
      if (frameRequest && typeof el.cancelVideoFrameCallback === "function") {
        el.cancelVideoFrameCallback(frameRequest);
      }
    };
  }, [remoteStream, onRemoteFrame]);

  const remoteVisible =
    Boolean(remoteStream) &&
    (state.phase === "warming" ||
      state.phase === "live" ||
      state.phase === "paused" ||
      state.phase === "ending" ||
      state.phase === "recap");
  const localVisible = Boolean(localStream) && !remoteVisible;
  const videoVisible = localVisible || remoteVisible;
  const isBusy = state.phase === "connecting" || state.phase === "warming";
  const countdownVisible =
    state.phase === "live" ||
    state.phase === "paused" ||
    state.phase === "ending";
  const controlsVisible =
    state.phase === "camera_ready" || isBusy || countdownVisible;

  return (
    <section className="relative flex aspect-video min-h-0 w-full flex-col overflow-hidden bg-v-beige-2 text-foreground lg:aspect-auto dark:bg-v-structure dark:text-structure-text">
      {/* Contained video (Fit) letterboxes against black, not the theme. */}
      {videoVisible && <div className="absolute inset-0 bg-black" aria-hidden />}

      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
          fit === "fit" && "object-contain",
          !remoteVisible && "opacity-0",
        )}
      />
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-300 [transform:scaleX(-1)]",
          fit === "fit" && "object-contain",
          !localVisible && "opacity-0",
        )}
      />

      {!localVisible && !remoteVisible && state.phase !== "error" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-s-4 p-s-6 text-center">
          <VideoOff className="size-10 opacity-60" aria-hidden />
          <div>
            <p className="text-v-title font-weight-v-semibold">
              Your camera is off
            </p>
            <p className="mt-s-1 text-v-small opacity-70">
              Enable it to see clothes land on you live.
            </p>
          </div>
          <HeroButton onClick={onEnableCamera}>Enable camera</HeroButton>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-s-3 p-s-4">
        <Badge variant={state.phase === "live" ? "olive" : "live"}>
          {PHASE_LABEL[state.phase]}
        </Badge>
        {countdownVisible && (
          <div className="pointer-events-auto">
            <Countdown remaining={state.remaining} warn={state.warn} />
          </div>
        )}
      </div>

      {isBusy && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="flex items-center gap-s-2 rounded-full bg-background/85 px-s-4 py-s-2 text-v-small text-foreground shadow-lg backdrop-blur">
            <Spinner className="size-4" />
            {state.phase === "connecting"
              ? "Connecting to the studio…"
              : "Warming up the model…"}
          </div>
        </div>
      )}

      {controlsVisible && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-s-3 bg-gradient-to-t from-black/60 via-black/25 to-transparent p-s-3 pt-s-10">
          <div className="pointer-events-auto flex flex-wrap items-center gap-s-2">
            {state.phase === "camera_ready" ? (
              <>
                <HeroButton size="sm" showArrow={false} onClick={onTryExample}>
                  Try an example
                </HeroButton>
                <Button
                  variant="ghost"
                  className="text-white! hover:bg-white/15! hover:text-white!"
                  onClick={onDisableCamera}
                >
                  Turn off camera
                </Button>
              </>
            ) : state.phase === "paused" ? (
              <>
                <HeroButton size="sm" showArrow={false} onClick={onResume}>
                  Resume
                </HeroButton>
                <Button
                  variant="ghost"
                  className="text-white! hover:bg-white/15! hover:text-white!"
                  onClick={onEndTry}
                >
                  End try
                </Button>
              </>
            ) : (
              <>
                {state.phase === "live" && (
                  <HeroButton size="sm" showArrow={false} onClick={onPause}>
                    Pause
                  </HeroButton>
                )}
                <Button
                  variant="ghost"
                  className="text-white! hover:bg-white/15! hover:text-white!"
                  onClick={onDisableCamera}
                >
                  Stop
                </Button>
              </>
            )}
          </div>

          {videoVisible && (
            <ToggleGroup
              type="single"
              value={fit}
              onValueChange={(next) => {
                if (next === "fill" || next === "fit") chooseFit(next);
              }}
              aria-label="Camera framing"
              className="v-seg pointer-events-auto shrink-0"
            >
              <ToggleGroupItem value="fill">Fill</ToggleGroupItem>
              <ToggleGroupItem value="fit">Fit</ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
      )}

      {state.phase === "recap" && state.recapReady && recapUrl && (
        <RecapCard
          url={recapUrl}
          onTryAgain={onTryAgain}
          onDismiss={onDismissRecap}
        />
      )}

      {state.phase === "error" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-s-6">
          <div className="max-w-md rounded-2xl bg-background/95 p-s-5 text-center text-foreground shadow-xl backdrop-blur">
            <p className="text-v-title font-weight-v-semibold">
              That did not work
            </p>
            <p className="mt-s-1 text-v-small text-muted-foreground">
              {state.error}
            </p>
            <div className="mt-s-4 flex justify-center gap-s-2">
              {localStream ? (
                <Button onClick={onTryAgain}>Try again</Button>
              ) : (
                <HeroButton
                  size="sm"
                  showArrow={false}
                  onClick={onEnableCamera}
                >
                  Enable camera
                </HeroButton>
              )}
              <Button variant="ghost" onClick={onDisableCamera}>
                Stop camera
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
