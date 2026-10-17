import { describe, expect, it } from "vitest";
import {
  LIVE_SECONDS,
  WARN_AT,
  initialSessionState,
  reduce,
  type SessionEvent,
  type SessionState,
} from "@/lib/session/machine";

const run = (state: SessionState, events: SessionEvent[]) =>
  events.reduce(reduce, state);

const cameraReady = () =>
  run(initialSessionState(), [{ type: "CAMERA_ON" }]);

const live = () =>
  run(cameraReady(), [
    { type: "GARMENT_SELECTED", imageUrl: "https://cdn/x.jpg" },
    { type: "CONNECTED" },
    { type: "FIRST_FRAME" },
  ]);

describe("constants", () => {
  it("caps a try at 20s and warns at 5s", () => {
    expect(LIVE_SECONDS).toBe(20);
    expect(WARN_AT).toBe(5);
  });
});

describe("initialSessionState", () => {
  it("starts with the camera off and no garment", () => {
    expect(initialSessionState()).toEqual({
      phase: "camera_off",
      remaining: 20,
      warn: false,
      garmentUrl: null,
      error: null,
      recapReady: false,
      resumed: false,
    });
  });
});

describe("camera events", () => {
  it("CAMERA_ON → camera_ready", () => {
    expect(cameraReady().phase).toBe("camera_ready");
  });

  it("CAMERA_FAILED → error with the message", () => {
    const next = run(initialSessionState(), [
      { type: "CAMERA_FAILED", message: "No camera found" },
    ]);
    expect(next.phase).toBe("error");
    expect(next.error).toBe("No camera found");
  });

  it("CAMERA_OFF clears recap and error state", () => {
    const errored = run(initialSessionState(), [
      { type: "CAMERA_FAILED", message: "boom" },
    ]);
    const off = reduce(errored, { type: "CAMERA_OFF" });
    expect(off.phase).toBe("camera_off");
    expect(off.error).toBeNull();
    expect(off.recapReady).toBe(false);
  });
});

describe("session lifecycle", () => {
  it("GARMENT_SELECTED from camera_ready → connecting with the garment stored", () => {
    const next = reduce(cameraReady(), {
      type: "GARMENT_SELECTED",
      imageUrl: "https://cdn/x.jpg",
    });
    expect(next.phase).toBe("connecting");
    expect(next.garmentUrl).toBe("https://cdn/x.jpg");
  });

  it("CONNECTED → warming", () => {
    const connecting = reduce(cameraReady(), {
      type: "GARMENT_SELECTED",
      imageUrl: "https://cdn/x.jpg",
    });
    expect(reduce(connecting, { type: "CONNECTED" }).phase).toBe("warming");
  });

  it("FIRST_FRAME → live with a full 20s clock", () => {
    const state = live();
    expect(state.phase).toBe("live");
    expect(state.remaining).toBe(20);
    expect(state.warn).toBe(false);
  });

  it("DISCONNECTED → recap with recapReady", () => {
    const ended = run(live(), [
      { type: "TICK" },
      { type: "DISCONNECTED" },
    ]);
    expect(ended.phase).toBe("recap");
    expect(ended.recapReady).toBe(true);
  });

  it("RECAP_DISMISSED → camera_ready with a fresh clock", () => {
    const dismissed = run(live(), [
      { type: "DISCONNECTED" },
      { type: "RECAP_DISMISSED" },
    ]);
    expect(dismissed.phase).toBe("camera_ready");
    expect(dismissed.recapReady).toBe(false);
    expect(dismissed.remaining).toBe(20);
  });
});

describe("the 20s clock", () => {
  it("TICK decrements while live", () => {
    const next = run(live(), [{ type: "TICK" }]);
    expect(next.remaining).toBe(19);
  });

  it("TICK is ignored outside the live phase", () => {
    expect(run(cameraReady(), [{ type: "TICK" }]).remaining).toBe(20);
  });

  it("warn turns on at 5s remaining", () => {
    const events = Array.from({ length: 15 }, () => ({ type: "TICK" as const }));
    const next = run(live(), events);
    expect(next.remaining).toBe(5);
    expect(next.warn).toBe(true);
  });

  it("ticking to exactly 0 moves to ending", () => {
    const events = Array.from({ length: 20 }, () => ({ type: "TICK" as const }));
    const next = run(live(), events);
    expect(next.remaining).toBe(0);
    expect(next.phase).toBe("ending");
  });

  it("picking a garment mid-try restarts the clock", () => {
    const fourteen = Array.from({ length: 14 }, () => ({ type: "TICK" as const }));
    const midTry = run(live(), fourteen);
    expect(midTry.remaining).toBe(6);

    const switched = reduce(midTry, {
      type: "GARMENT_SELECTED",
      imageUrl: "https://cdn/y.jpg",
    });
    expect(switched.phase).toBe("live");
    expect(switched.remaining).toBe(20);
    expect(switched.warn).toBe(false);
    expect(switched.garmentUrl).toBe("https://cdn/y.jpg");
  });
});

describe("pause / resume", () => {
  it("PAUSE banks the clock and freezes it", () => {
    const midTry = run(
      live(),
      Array.from({ length: 8 }, () => ({ type: "TICK" as const })),
    );
    expect(midTry.remaining).toBe(12);

    const paused = reduce(midTry, { type: "PAUSE" });
    expect(paused.phase).toBe("paused");
    expect(paused.remaining).toBe(12);
    expect(paused.warn).toBe(false);

    const ticked = reduce(paused, { type: "TICK" });
    expect(ticked.phase).toBe("paused");
    expect(ticked.remaining).toBe(12);
  });

  it("RESUME → FIRST_FRAME keeps the banked seconds", () => {
    const paused = run(live(), [
      ...Array.from({ length: 8 }, () => ({ type: "TICK" as const })),
      { type: "PAUSE" },
    ]);
    expect(paused.remaining).toBe(12);

    const resumed = run(paused, [
      { type: "RESUME" },
      { type: "CONNECTED" },
      { type: "FIRST_FRAME" },
    ]);
    expect(resumed.phase).toBe("live");
    expect(resumed.remaining).toBe(12);
    expect(resumed.resumed).toBe(false);
  });

  it("a resume that lands under 5s still warns", () => {
    const paused = run(live(), [
      ...Array.from({ length: 17 }, () => ({ type: "TICK" as const })),
      { type: "PAUSE" },
    ]);
    expect(paused.remaining).toBe(3);

    const resumed = run(paused, [
      { type: "RESUME" },
      { type: "FIRST_FRAME" },
    ]);
    expect(resumed.phase).toBe("live");
    expect(resumed.remaining).toBe(3);
    expect(resumed.warn).toBe(true);
  });

  it("a fresh garment pick while paused starts a new 20s try", () => {
    const paused = run(live(), [
      ...Array.from({ length: 9 }, () => ({ type: "TICK" as const })),
      { type: "PAUSE" },
    ]);

    const picked = reduce(paused, {
      type: "GARMENT_SELECTED",
      imageUrl: "https://cdn/z.jpg",
    });
    expect(picked.phase).toBe("connecting");
    expect(picked.remaining).toBe(20);
    expect(picked.resumed).toBe(false);
    expect(picked.garmentUrl).toBe("https://cdn/z.jpg");

    const liveAgain = run(picked, [
      { type: "CONNECTED" },
      { type: "FIRST_FRAME" },
    ]);
    expect(liveAgain.remaining).toBe(20);
  });

  it("END_TRY while paused → recap; ignored while live", () => {
    const paused = reduce(live(), { type: "PAUSE" });
    const ended = reduce(paused, { type: "END_TRY" });
    expect(ended.phase).toBe("recap");
    expect(ended.recapReady).toBe(true);

    expect(reduce(live(), { type: "END_TRY" }).phase).toBe("live");
  });

  it("PAUSE and RESUME only act from their own phase", () => {
    expect(reduce(cameraReady(), { type: "PAUSE" }).phase).toBe("camera_ready");
    expect(reduce(live(), { type: "RESUME" }).phase).toBe("live");
    expect(reduce(live(), { type: "PAUSE" }).resumed).toBe(false);
  });

  it("a non-resume connect still restarts the clock", () => {
    const picked = reduce(cameraReady(), {
      type: "GARMENT_SELECTED",
      imageUrl: "https://cdn/x.jpg",
    });
    const liveAgain = run(picked, [
      { type: "CONNECTED" },
      { type: "FIRST_FRAME" },
    ]);
    expect(liveAgain.remaining).toBe(20);
    expect(liveAgain.resumed).toBe(false);
  });
});

describe("error + retry", () => {
  it("ERROR → error phase with message, RETRY → connecting when a garment is set", () => {
    const errored = reduce(live(), { type: "ERROR", message: "stream died" });
    expect(errored.phase).toBe("error");
    expect(errored.error).toBe("stream died");

    const retried = reduce(errored, { type: "RETRY" });
    expect(retried.phase).toBe("connecting");
    expect(retried.error).toBeNull();
  });

  it("RETRY without a garment → camera_ready", () => {
    const errored = reduce(cameraReady(), {
      type: "ERROR",
      message: "nope",
    });
    expect(reduce(errored, { type: "RETRY" }).phase).toBe("camera_ready");
  });
});

describe("stall guard", () => {
  it("STALLED while connecting or warming → error", () => {
    const connecting = reduce(cameraReady(), {
      type: "GARMENT_SELECTED",
      imageUrl: "https://cdn/x.jpg",
    });
    const stalled = reduce(connecting, { type: "STALLED" });
    expect(stalled.phase).toBe("error");
    expect(stalled.error).toContain("too long");

    const warming = reduce(connecting, { type: "CONNECTED" });
    expect(reduce(warming, { type: "STALLED" }).phase).toBe("error");
  });

  it("STALLED is ignored once live", () => {
    const next = reduce(live(), { type: "STALLED" });
    expect(next.phase).toBe("live");
    expect(next.error).toBeNull();
  });
});
