export const LIVE_SECONDS = 20;
export const WARN_AT = 5;

export type Phase =
  | "camera_off"
  | "camera_ready"
  | "connecting"
  | "warming"
  | "live"
  | "ending"
  | "recap"
  | "error";

export type SessionEvent =
  | { type: "CAMERA_ON" }
  | { type: "CAMERA_OFF" }
  | { type: "CAMERA_FAILED"; message: string }
  | { type: "GARMENT_SELECTED"; imageUrl: string }
  | { type: "CONNECTED" }
  | { type: "FIRST_FRAME" }
  | { type: "TICK" }
  | { type: "DISCONNECTED" }
  | { type: "ERROR"; message: string }
  | { type: "RETRY" }
  | { type: "RECAP_DISMISSED" };

export type SessionState = {
  phase: Phase;
  remaining: number;
  warn: boolean;
  garmentUrl: string | null;
  error: string | null;
  recapReady: boolean;
};

export function initialSessionState(): SessionState {
  return {
    phase: "camera_off",
    remaining: LIVE_SECONDS,
    warn: false,
    garmentUrl: null,
    error: null,
    recapReady: false,
  };
}

function freshClock(): Pick<SessionState, "remaining" | "warn"> {
  return { remaining: LIVE_SECONDS, warn: false };
}

/**
 * Pure session reducer. The hook owns side effects (camera, streams, timers);
 * this function owns the phase graph:
 *
 *   camera_off → camera_ready → connecting → warming → live → ending → recap
 *                    ↖──────────────── RECAP_DISMISSED ────────────────┘
 *   error ← (any phase), RETRY → connecting (garment set) | camera_ready
 */
export function reduce(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case "CAMERA_ON":
      return { ...state, phase: "camera_ready", error: null, recapReady: false };

    case "CAMERA_OFF":
      return {
        ...state,
        phase: "camera_off",
        error: null,
        recapReady: false,
        ...freshClock(),
      };

    case "CAMERA_FAILED":
      return { ...state, phase: "error", error: event.message };

    case "GARMENT_SELECTED": {
      const base = {
        ...state,
        garmentUrl: event.imageUrl,
        error: null,
        ...freshClock(),
      };
      // First pick arms the connection; later picks just restart the clock.
      if (state.phase === "camera_ready") return { ...base, phase: "connecting" };
      return base;
    }

    case "CONNECTED":
      return state.phase === "connecting"
        ? { ...state, phase: "warming" }
        : state;

    case "FIRST_FRAME":
      // The clock only starts when the first AI frame hits the screen.
      return state.phase === "connecting" || state.phase === "warming"
        ? { ...state, phase: "live", ...freshClock() }
        : state;

    case "TICK": {
      if (state.phase !== "live") return state;
      const remaining = Math.max(0, state.remaining - 1);
      if (remaining === 0) {
        return { ...state, remaining, warn: true, phase: "ending" };
      }
      return { ...state, remaining, warn: remaining <= WARN_AT };
    }

    case "DISCONNECTED": {
      const wasTrying =
        state.phase === "connecting" ||
        state.phase === "warming" ||
        state.phase === "live" ||
        state.phase === "ending";
      return wasTrying
        ? { ...state, phase: "recap", recapReady: true, warn: false }
        : state;
    }

    case "ERROR":
      return { ...state, phase: "error", error: event.message };

    case "RETRY":
      return state.garmentUrl
        ? { ...state, phase: "connecting", error: null }
        : { ...state, phase: "camera_ready", error: null };

    case "RECAP_DISMISSED":
      return {
        ...state,
        phase: "camera_ready",
        recapReady: false,
        error: null,
        ...freshClock(),
      };
  }
}
