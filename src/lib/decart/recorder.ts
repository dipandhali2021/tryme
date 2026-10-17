"use client";

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

/**
 * Records the AI (remote) stream so every try leaves a replay behind.
 * Started on the first AI frame, stopped when the 20s clock ends.
 */
export class TryOnRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private done: Promise<Blob | null> | null = null;

  start(stream: MediaStream): void {
    if (this.recorder) return;
    if (typeof MediaRecorder === "undefined") return;
    const mimeType = MIME_CANDIDATES.find((candidate) =>
      MediaRecorder.isTypeSupported(candidate),
    );
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    this.chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data);
    };
    this.done = new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const blob =
          this.chunks.length > 0
            ? new Blob(this.chunks, {
                type: recorder.mimeType || "video/webm",
              })
            : null;
        this.recorder = null;
        this.chunks = [];
        resolve(blob);
      };
    });
    this.recorder = recorder;
    recorder.start(1000);
  }

  async stop(): Promise<Blob | null> {
    const recorder = this.recorder;
    if (!recorder) return null;
    const done = this.done;
    if (recorder.state !== "inactive") recorder.stop();
    return done ? await done : null;
  }
}

/**
 * WebM from MediaRecorder reports `duration: Infinity` until the video is
 * forced to scan the whole file. Spec (per the Anywear extension): seek past
 * the end once, clamp to the real duration, rewind, resume — lifting `loop`
 * during the round trip so Safari does not fight the seek.
 * Returns a cancel function.
 */
export function prepareRecap(
  video: HTMLVideoElement,
  url: string,
): () => void {
  let cancelled = false;
  const wasLooping = video.loop;
  video.loop = false;

  const fixDuration = async () => {
    if (cancelled) return;
    try {
      if (video.duration === Infinity || Number.isNaN(video.duration)) {
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            resolve();
          };
          video.addEventListener("seeked", onSeeked);
          video.currentTime = 1e101;
        });
        if (cancelled) return;
        // `duration` now reads the real length; rewind and resume.
        video.currentTime = 0;
      }
    } finally {
      if (!cancelled) video.loop = wasLooping;
    }
  };

  const onLoaded = () => {
    void fixDuration();
  };

  if (video.src !== url) {
    video.src = url;
  }
  if (video.readyState >= 1) {
    void fixDuration();
  } else {
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
  }

  return () => {
    cancelled = true;
    video.removeEventListener("loadedmetadata", onLoaded);
    video.loop = wasLooping;
  };
}

/** `tryme-<YYYYMMDD>-<HHmm>.webm` from a local-time date. */
export function recapFileName(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `tryme-${stamp}.webm`;
}
