"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { RealTimeClient, createDecartClient, models } from "@decartai/sdk";
import { TryOnRecorder } from "@/lib/decart/recorder";
import {
  initialSessionState,
  reduce,
  type SessionState,
} from "@/lib/session/machine";

type SdkClient = ReturnType<typeof createDecartClient>;
type RealtimeModel = ReturnType<typeof models.realtime>;
type Sdk = { client: SdkClient; model: RealtimeModel };

export type UseTryOnSession = {
  state: SessionState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  recapUrl: string | null;
  enableCamera: () => Promise<void>;
  disableCamera: () => void;
  tryGarment: (source: GarmentSource) => void;
  tryAgain: () => void;
  dismissRecap: () => void;
  notifyRemoteFrame: () => void;
};

/** A garment to try on: a remote image URL, or a local file/URL from drag & drop. */
export type GarmentSource = string | { file: File } | { url: string };

/**
 * Normalize any garment source to a string the session can hold on to and
 * re-fetch later (Try again). Local files become object URLs — kept alive on
 * purpose so retrying a device photo can reuse its bytes.
 */
function sourceToUrl(source: GarmentSource): string {
  if (typeof source === "string") return source;
  if ("file" in source) return URL.createObjectURL(source.file);
  return source.url;
}

/** Fetch garment bytes: object URLs directly, remote URLs via our proxy. */
async function fetchGarmentBlob(url: string): Promise<Blob> {
  const target = url.startsWith("blob:")
    ? url
    : `/api/proxy-image?url=${encodeURIComponent(url)}`;
  const res = await fetch(target);
  if (!res.ok) throw new Error("Could not load that garment image.");
  return await res.blob();
}

// Matches the lucy-vton-latest model definition (1280×720, 30fps ideal).
const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
  audio: false,
};

function describeError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") {
      return "Camera permission was denied. Allow camera access in your browser, then try again.";
    }
    if (err.name === "NotFoundError") {
      return "No camera was found on this device.";
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong.";
}

/**
 * The live try-on session: camera capture, the Decart realtime stream, the
 * 20s clock, and garment handoff. All phases come from the pure reducer in
 * `@/lib/session/machine`; this hook owns every side effect.
 */
export function useTryOnSession(): UseTryOnSession {
  const [state, dispatch] = useReducer(reduce, undefined, initialSessionState);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [recapUrl, setRecapUrl] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<RealTimeClient | null>(null);
  const apiRef = useRef<Sdk | null>(null);
  const fileIdsRef = useRef(new Map<string, string>());
  const pendingGarmentRef = useRef<string | null>(null);
  const connectingRef = useRef(false);
  const recorderRef = useRef<TryOnRecorder | null>(null);

  useEffect(() => {
    remoteStreamRef.current = remoteStream;
  }, [remoteStream]);

  /** Lazily create the SDK client (browser-only; the key never reaches us). */
  const getApi = useCallback(async (): Promise<Sdk> => {
    if (!apiRef.current) {
      const sdk = await import("@decartai/sdk");
      apiRef.current = {
        client: sdk.createDecartClient({
          apiKeyProvider: async () => {
            const res = await fetch("/api/realtime-token", { method: "POST" });
            if (!res.ok) {
              throw new Error(
                "Could not get a session token — is DECART_API_KEY set?",
              );
            }
            const data = (await res.json()) as { apiKey?: string };
            if (!data.apiKey) throw new Error("Token response was missing apiKey");
            return data.apiKey;
          },
        }),
        model: sdk.models.realtime("lucy-vton-latest"),
      };
    }
    return apiRef.current;
  }, []);

  /** Fetch a garment image (proxy for URLs, direct for object URLs) and upload it to Decart once. */
  const ensureFileId = useCallback(
    async (imageUrl: string): Promise<string> => {
      const cache = fileIdsRef.current;
      const hit = cache.get(imageUrl);
      if (hit) return hit;
      const blob = await fetchGarmentBlob(imageUrl);
      const { client } = await getApi();
      const ref = await client.files.upload(blob, { ttlSeconds: 3600 });
      cache.set(imageUrl, ref.id);
      return ref.id;
    },
    [getApi],
  );

  const clearSession = useCallback(() => {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    connectingRef.current = false;
    // Keep `remoteStream` so the stage can freeze on the last AI frame.
  }, []);

  /** Stop any in-flight recording and hand back its blob (may be null). */
  const stopRecorder = useCallback((): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    return recorder ? recorder.stop() : Promise.resolve(null);
  }, []);

  /** Drop the recap URL and release its blob. */
  const clearRecap = useCallback(() => {
    setRecapUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const startSession = useCallback(
    async (garmentUrl: string) => {
      if (connectingRef.current || sessionRef.current) return;
      const local = localStreamRef.current;
      if (!local) {
        dispatch({ type: "ERROR", message: "Camera is off — enable it first." });
        return;
      }
      connectingRef.current = true;
      // A new try invalidates the previous recording and recap.
      void stopRecorder();
      clearRecap();
      try {
        const { client, model } = await getApi();
        const fileId = await ensureFileId(garmentUrl);
        const session = await client.realtime.connect(local, {
          model,
          speed: "fast",
          mirror: "auto",
          initialState: { image: fileId },
          onRemoteStream: (stream) => setRemoteStream(stream),
          onConnectionChange: (connection) => {
            if (connection === "connected") dispatch({ type: "CONNECTED" });
            if (connection === "disconnected") {
              dispatch({ type: "DISCONNECTED" });
            }
          },
        });
        sessionRef.current = session;
        connectingRef.current = false;
        session.on("error", (err) => {
          void stopRecorder();
          dispatch({ type: "ERROR", message: describeError(err) });
        });
        session.on("sessionEnded", (ended) => {
          void stopRecorder();
          const reason =
            ended && typeof ended === "object" && "reason" in ended
              ? String((ended as { reason?: unknown }).reason ?? "")
              : "";
          dispatch({
            type: "ERROR",
            message: reason
              ? `The session ended: ${reason.replaceAll("_", " ")}`
              : "The try-on session ended unexpectedly.",
          });
        });
        // The user may have picked another garment while we were connecting.
        const pending = pendingGarmentRef.current;
        if (pending && pending !== garmentUrl) {
          const pendingFile = await ensureFileId(pending);
          await session.set({ image: pendingFile });
        }
        pendingGarmentRef.current = null;
      } catch (err) {
        connectingRef.current = false;
        sessionRef.current = null;
        dispatch({ type: "ERROR", message: describeError(err) });
      }
    },
    [clearRecap, ensureFileId, getApi, stopRecorder],
  );

  const enableCamera = useCallback(async () => {
    if (localStreamRef.current) return;
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      localStreamRef.current = stream;
      setLocalStream(stream);
      dispatch({ type: "CAMERA_ON" });
    } catch (err) {
      dispatch({ type: "CAMERA_FAILED", message: describeError(err) });
    }
  }, []);

  const disableCamera = useCallback(() => {
    void stopRecorder();
    clearRecap();
    clearSession();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    pendingGarmentRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    dispatch({ type: "CAMERA_OFF" });
  }, [clearRecap, clearSession, stopRecorder]);

  const tryGarment = useCallback(
    (source: GarmentSource) => {
      // Normalize files/URLs to a stable string first (see sourceToUrl).
      const imageUrl = sourceToUrl(source);
      const phase = stateRef.current.phase;
      pendingGarmentRef.current = imageUrl;
      dispatch({ type: "GARMENT_SELECTED", imageUrl });

      if (phase === "camera_ready") {
        void startSession(imageUrl);
        return;
      }
      if (phase === "recap" || phase === "error") {
        dispatch({ type: "RETRY" }); // → connecting (garment is now set)
        void startSession(imageUrl);
        return;
      }
      // Connecting/warming/live: swap the reference image in place. The clock
      // was restarted by GARMENT_SELECTED. While connecting, startSession's
      // drain picks up the pending pick.
      const session = sessionRef.current;
      if (session) {
        void (async () => {
          try {
            const fileId = await ensureFileId(imageUrl);
            await session.set({ image: fileId });
            if (pendingGarmentRef.current === imageUrl) {
              pendingGarmentRef.current = null;
            }
          } catch (err) {
            dispatch({ type: "ERROR", message: describeError(err) });
          }
        })();
      }
    },
    [ensureFileId, startSession],
  );

  const tryAgain = useCallback(() => {
    const garment = stateRef.current.garmentUrl;
    if (!garment) return;
    pendingGarmentRef.current = garment;
    dispatch({ type: "RETRY" });
    void startSession(garment);
  }, [startSession]);

  const dismissRecap = useCallback(() => {
    clearRecap();
    dispatch({ type: "RECAP_DISMISSED" });
  }, [clearRecap]);

  const notifyRemoteFrame = useCallback(() => {
    const phase = stateRef.current.phase;
    // The first AI frame is both the clock start and the recording start.
    if (
      (phase === "connecting" || phase === "warming") &&
      remoteStreamRef.current
    ) {
      if (!recorderRef.current) recorderRef.current = new TryOnRecorder();
      recorderRef.current.start(remoteStreamRef.current);
    }
    dispatch({ type: "FIRST_FRAME" });
  }, []);

  // The 20s clock ticks only while live.
  useEffect(() => {
    if (state.phase !== "live") return;
    const id = window.setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => window.clearInterval(id);
  }, [state.phase]);

  // At 0s the reducer moves to `ending`: stop the recording, close the
  // session, then land on the recap (or skip it when nothing was recorded).
  useEffect(() => {
    if (state.phase !== "ending") return;
    let cancelled = false;
    void (async () => {
      const blob = await stopRecorder();
      if (cancelled) return;
      clearSession();
      if (blob && blob.size > 0) {
        const url = URL.createObjectURL(blob);
        setRecapUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        dispatch({ type: "DISCONNECTED" });
      } else {
        // Short session, nothing usable recorded — straight back to camera.
        dispatch({ type: "DISCONNECTED" });
        dispatch({ type: "RECAP_DISMISSED" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.phase, clearSession, stopRecorder]);

  // Tear everything down on unmount.
  useEffect(() => {
    return () => {
      void recorderRef.current?.stop();
      sessionRef.current?.disconnect();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return {
    state,
    localStream,
    remoteStream,
    recapUrl,
    enableCamera,
    disableCamera,
    tryGarment,
    tryAgain,
    dismissRecap,
    notifyRemoteFrame,
  };
}
