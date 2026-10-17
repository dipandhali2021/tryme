export const LIVE_SECONDS = 20;
export const WARN_AT = 5;

export type Phase =
  | "camera_off"
  | "camera_ready"
  | "connecting"
  | "warming"
  | "live"
  | "paused"
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
  | { type: "STALLED" }
  | { type: "ERROR"; message: string }
  | { type: "RETRY" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "END_TRY" }
  | { type: "RECAP_DISMISSED" };

export type SessionState = {
  phase: Phase;
  remaining: number;
  warn: boolean;
  garmentUrl: string | null;
  error: string | null;
  recapReady: boolean;
  /** Set by RESUME so the next FIRST_FRAME banks time instead of restarting. */
  resumed: boolean;
};

export function initialSessionState(): SessionState {
  return {
    phase: "camera_off",
    remaining: LIVE_SECONDS,
    warn: false,
    garmentUrl: null,
    error: null,
    recapReady: false,
    resumed: false,
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
 *   live ⇄ paused (stream dropped, seconds banked; RESUME keeps them, END_TRY → recap)
 *   error ← (any phase), RETRY → connecting (garment set) | camera_ready
 */
export function reduce(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case "CAMERA_ON":
      return {
        ...state,
        phase: "camera_ready",
        error: null,
        recapReady: false,
        resumed: false,
      };

    case "CAMERA_OFF":
      return {
        ...state,
        phase: "camera_off",
        error: null,
        recapReady: false,
        resumed: false,
        ...freshClock(),
      };

    case "CAMERA_FAILED":
      return { ...state, phase: "error", error: event.message };

    case "GARMENT_SELECTED": {
      const base = {
        ...state,
        garmentUrl: event.imageUrl,
        error: null,
        resumed: false,
        ...freshClock(),
      };
      // First pick — or a fresh pick while paused — arms the connection;
      // later picks just restart the clock.
      if (state.phase === "camera_ready" || state.phase === "paused")
        return { ...base, phase: "connecting" };
      return base;
    }

    case "CONNECTED":
      return state.phase === "connecting"
        ? { ...state, phase: "warming" }
        : state;

    case "FIRST_FRAME": {
      // The clock only starts when the first AI frame hits the screen. A resumed
      // connection keeps the seconds banked at pause instead of restarting.
      const arming = state.phase === "connecting" || state.phase === "warming";
      if (!arming) return state;
      if (state.resumed) {
        return {
          ...state,
          phase: "live",
          warn: state.remaining <= WARN_AT,
          resumed: false,
        };
      }
      return { ...state, phase: "live", ...freshClock() };
    }

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

    case "STALLED":
      // No first frame inside the guard window: abort instead of letting the
      // session stream (and bill) without the clock ever starting.
      return state.phase === "connecting" || state.phase === "warming"
        ? {
            ...state,
            phase: "error",
            error: "The try-on took too long to start. Try again — it usually takes a few seconds.",
          }
        : state;

    case "ERROR":
      return { ...state, phase: "error", error: event.message };

    case "RETRY":
      return state.garmentUrl
        ? { ...state, phase: "connecting", error: null, resumed: false }
        : { ...state, phase: "camera_ready", error: null, resumed: false };

    case "PAUSE":
      // Dropping the stream stops billing that instant; banked seconds stay put.
      return state.phase === "live"
        ? { ...state, phase: "paused", warn: false }
        : state;

    case "RESUME":
      return state.phase === "paused"
        ? { ...state, phase: "connecting", resumed: true, error: null }
        : state;

    case "END_TRY":
      return state.phase === "paused"
        ? { ...state, phase: "recap", recapReady: true, warn: false }
        : state;

    case "RECAP_DISMISSED":
      return {
        ...state,
        phase: "camera_ready",
        recapReady: false,
        error: null,
        resumed: false,
        ...freshClock(),
      };
  }
}
