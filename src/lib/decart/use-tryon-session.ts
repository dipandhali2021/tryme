"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { RealTimeClient, createDecartClient, models } from "@decartai/sdk";
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
  enableCamera: () => Promise<void>;
  disableCamera: () => void;
  tryGarment: (imageUrl: string) => void;
  tryAgain: () => void;
  dismissRecap: () => void;
  notifyRemoteFrame: () => void;
};

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

  const stateRef = useRef(state);
  stateRef.current = state;

  const localStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<RealTimeClient | null>(null);
  const apiRef = useRef<Sdk | null>(null);
  const fileIdsRef = useRef(new Map<string, string>());
  const pendingGarmentRef = useRef<string | null>(null);
  const connectingRef = useRef(false);

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

  /** Fetch a garment image through our proxy and upload it to Decart once. */
  const ensureFileId = useCallback(
    async (imageUrl: string): Promise<string> => {
      const cache = fileIdsRef.current;
      const hit = cache.get(imageUrl);
      if (hit) return hit;
      const res = await fetch(
        `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`,
      );
      if (!res.ok) throw new Error("Could not load that garment image.");
      const blob = await res.blob();
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

  const startSession = useCallback(
    async (garmentUrl: string) => {
      if (connectingRef.current || sessionRef.current) return;
      const local = localStreamRef.current;
      if (!local) {
        dispatch({ type: "ERROR", message: "Camera is off — enable it first." });
        return;
      }
      connectingRef.current = true;
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
          dispatch({ type: "ERROR", message: describeError(err) });
        });
        session.on("sessionEnded", (ended) => {
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
    [ensureFileId, getApi],
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
    clearSession();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    pendingGarmentRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    dispatch({ type: "CAMERA_OFF" });
  }, [clearSession]);

  const tryGarment = useCallback(
    (imageUrl: string) => {
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
    dispatch({ type: "RECAP_DISMISSED" });
  }, []);

  const notifyRemoteFrame = useCallback(() => {
    dispatch({ type: "FIRST_FRAME" });
  }, []);

  // The 20s clock ticks only while live.
  useEffect(() => {
    if (state.phase !== "live") return;
    const id = window.setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => window.clearInterval(id);
  }, [state.phase]);

  // At 0s the reducer moves to `ending`: close the session, then recap.
  useEffect(() => {
    if (state.phase !== "ending") return;
    clearSession();
    dispatch({ type: "DISCONNECTED" });
  }, [state.phase, clearSession]);

  // Tear everything down on unmount.
  useEffect(() => {
    return () => {
      sessionRef.current?.disconnect();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return {
    state,
    localStream,
    remoteStream,
    enableCamera,
    disableCamera,
    tryGarment,
    tryAgain,
    dismissRecap,
    notifyRemoteFrame,
  };
}
