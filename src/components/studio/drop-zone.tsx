"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import {
  extractImageSource,
  type ExternalImageSource,
} from "@/lib/studio/external";

export type DropZoneProps = {
  onSource: (source: ExternalImageSource) => void;
  children: React.ReactNode;
};

/**
 * Window-wide drop & paste capture. Shows a full-screen hint while a drag is
 * in flight and forwards the first usable image to `onSource`.
 */
export function DropZone({ onSource, children }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const onSourceRef = useRef(onSource);
  onSourceRef.current = onSource;

  useEffect(() => {
    let depth = 0;

    const relevant = (event: DragEvent) => {
      const types = event.dataTransfer?.types;
      return Boolean(
        types &&
          (types.includes("Files") ||
            types.includes("text/uri-list") ||
            types.includes("text/plain")),
      );
    };

    const endDrag = () => {
      depth = 0;
      setDragging(false);
    };

    const onDragEnter = (event: DragEvent) => {
      if (!relevant(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };

    const onDragOver = (event: DragEvent) => {
      if (!relevant(event)) return;
      event.preventDefault();
    };

    const onDragLeave = (event: DragEvent) => {
      depth = Math.max(0, depth - 1);
      if (event.relatedTarget === null || depth === 0) endDrag();
    };

    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      endDrag();
      const data = event.dataTransfer;
      if (!data) return;
      const source = extractImageSource(data);
      if (source) onSourceRef.current(source);
    };

    const onPaste = (event: ClipboardEvent) => {
      const data = event.clipboardData;
      if (!data) return;
      const source = extractImageSource(data);
      if (source) onSourceRef.current(source);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, []);

  return (
    <>
      {children}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-s-6 backdrop-blur-sm">
          <div className="flex h-full w-full flex-col items-center justify-center gap-s-4 rounded-3xl border-2 border-dashed border-white/50 p-s-8 text-center text-white">
            <ImagePlus className="size-12" aria-hidden />
            <p className="text-v-hero font-weight-v-semibold">
              Drop it. It&apos;s yours in 20 seconds.
            </p>
            <p className="text-v-small opacity-80">
              An image from any tab — or straight from your device.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
