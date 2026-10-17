"use client";

import { useEffect, useRef } from "react";
import { VideoOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeroButton } from "@/components/ui/hero-button";
import { Spinner } from "@/components/ui/spinner";
import { Countdown } from "@/components/studio/countdown";
import type { SessionState } from "@/lib/session/machine";
import { cn } from "@/lib/utils";

export type CameraStageProps = {
  state: SessionState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEnableCamera: () => void;
  onDisableCamera: () => void;
  onTryExample: () => void;
  onTryAgain: () => void;
  onDismissRecap: () => void;
  onRemoteFrame: () => void;
};

const PHASE_LABEL: Record<SessionState["phase"], string> = {
  camera_off: "Camera off",
  camera_ready: "Ready",
  connecting: "Connecting…",
  warming: "Warming up…",
  live: "On you",
  ending: "Wrapping up…",
  recap: "Ended",
  error: "Error",
};

/**
 * The left half of the studio: mirrored camera frame, status badge, the 20s
 * countdown overlay, and the try controls.
 */
export function CameraStage({
  state,
  localStream,
  remoteStream,
  onEnableCamera,
  onDisableCamera,
  onTryExample,
  onTryAgain,
  onDismissRecap,
  onRemoteFrame,
}: CameraStageProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

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
    if (typeof el.requestVideoFrameCallback === "function") {
      el.requestVideoFrameCallback(() => fire());
    } else {
      el.addEventListener("playing", fire, { once: true });
    }
    return () => el.removeEventListener("playing", fire);
  }, [remoteStream, onRemoteFrame]);

  const remoteVisible =
    Boolean(remoteStream) &&
    (state.phase === "warming" ||
      state.phase === "live" ||
      state.phase === "ending" ||
      state.phase === "recap");
  const localVisible = Boolean(localStream) && !remoteVisible;
  const isBusy = state.phase === "connecting" || state.phase === "warming";
  const countdownVisible = state.phase === "live" || state.phase === "ending";

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-v-structure text-[color:var(--structure-text)]">
      <div className="flex min-h-0 flex-1 items-center justify-center p-s-5">
        <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-3xl border border-structure-line/50 bg-black shadow-2xl">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              !remoteVisible && "opacity-0",
            )}
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]",
              !localVisible && "opacity-0",
            )}
          />

          {!localVisible && !remoteVisible && state.phase !== "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-s-4 p-s-6 text-center">
              <VideoOff className="size-10 opacity-60" aria-hidden />
              <div>
                <p className="text-v-title font-weight-v-semibold">
                  Your camera is off
                </p>
                <p className="mt-s-1 text-v-small opacity-70">
                  Enable it to see clothes land on you live.
                </p>
              </div>
              <HeroButton onClick={onEnableCamera}>
                Enable camera
              </HeroButton>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-s-3 p-s-4">
            <Badge variant={state.phase === "live" ? "olive" : "live"}>
              {PHASE_LABEL[state.phase]}
            </Badge>
            {countdownVisible && (
              <div className="pointer-events-auto">
                <Countdown remaining={state.remaining} warn={state.warn} />
              </div>
            )}
          </div>

          {isBusy && !countdownVisible && (
            <div className="absolute inset-x-0 bottom-s-4 flex justify-center">
              <div className="flex items-center gap-s-2 rounded-full bg-background/85 px-s-4 py-s-2 text-v-small text-foreground shadow-lg backdrop-blur">
                <Spinner className="size-4" />
                {state.phase === "connecting"
                  ? "Connecting to the studio…"
                  : "Warming up the model…"}
              </div>
            </div>
          )}

          {state.phase === "recap" && state.recapReady && (
            <div className="absolute inset-x-0 bottom-s-5 flex justify-center p-s-4">
              <div className="flex items-center gap-s-3 rounded-2xl bg-background/92 p-s-4 text-foreground shadow-xl backdrop-blur">
                <div className="mr-s-2">
                  <p className="text-v-control font-weight-v-semibold">
                    Nice try!
                  </p>
                  <p className="text-v-small text-muted-foreground">
                    Clip replay lands here in the next step.
                  </p>
                </div>
                <HeroButton size="sm" showArrow={false} onClick={onTryAgain}>
                  Try again
                </HeroButton>
                <Button variant="ghost" size="sm" onClick={onDismissRecap}>
                  Pick another
                </Button>
              </div>
            </div>
          )}

          {state.phase === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-s-6">
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
        </div>
      </div>

      <footer className="flex min-h-14 items-center justify-center gap-s-3 pb-s-6">
        {state.phase === "camera_off" && (
          <HeroButton onClick={onEnableCamera}>
            Enable camera
          </HeroButton>
        )}
        {state.phase === "camera_ready" && (
          <>
            <HeroButton showArrow={false} onClick={onTryExample}>
              Try an example
            </HeroButton>
            <Button variant="ghost" onClick={onDisableCamera}>
              Turn off camera
            </Button>
          </>
        )}
        {(state.phase === "connecting" ||
          state.phase === "warming" ||
          state.phase === "live" ||
          state.phase === "ending") && (
          <Button variant="ghost" onClick={onDisableCamera}>
            Stop
          </Button>
        )}
      </footer>
    </section>
  );
}
