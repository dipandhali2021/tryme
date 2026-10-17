"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import {
  extractImageSource,
  type ExternalImageSource,
} from "@/lib/studio/external";

export type DropZoneProps = {
  onSource: (source: ExternalImageSource) => void;
  /**
   * Text paste/drop that carried no image file. Return true when the text was
   * claimed (e.g. a product link that starts an import); the URL also wins
   * over the image-source path when claimed.
   */
  onLink?: (text: string) => boolean;
  children: React.ReactNode;
};

/**
 * Window-wide drop & paste capture. Shows a full-screen hint while a drag is
 * in flight and forwards the first usable image (or link text) to its handler.
 */
export function DropZone({ onSource, onLink, children }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const onSourceRef = useRef(onSource);
  const onLinkRef = useRef(onLink);

  useEffect(() => {
    onSourceRef.current = onSource;
    onLinkRef.current = onLink;
  }, [onSource, onLink]);

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
      if (source) {
        // A product link the host claims beats the generic URL-as-image path.
        if (source.kind === "url" && onLinkRef.current?.(source.url)) return;
        onSourceRef.current(source);
        return;
      }
      const text = (
        data.getData("text/uri-list") || data.getData("text/plain")
      ).trim();
      if (text) onLinkRef.current?.(text);
    };

    const onPaste = (event: ClipboardEvent) => {
      // An input may have already claimed this paste (e.g. the link box).
      if (event.defaultPrevented) return;
      const data = event.clipboardData;
      if (!data) return;
      const source = extractImageSource(data);
      if (source) {
        if (source.kind === "url" && onLinkRef.current?.(source.url)) return;
        onSourceRef.current(source);
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, [contenteditable='true']")
      ) {
        return;
      }
      const text = data.getData("text/plain").trim();
      if (text) onLinkRef.current?.(text);
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
              An image or a product link from any tab — or from your device.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
