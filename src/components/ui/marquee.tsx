"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Meta } from "@/components/ui/typography";
import { useGuidanceMotion } from "@/lib/cojeev-motion/use-guidance-motion";
import { assignMotionRef } from "@/lib/cojeev-motion/refs";
import { advanceMarquee, marqueeDepth, marqueeScrollVelocity, type MarqueeMotion } from "@/lib/cojeev/marquee-motion";

export type MarqueeDirection = "left" | "right";
export type MarqueeSpeed = "slow" | "normal" | "fast";
export type MarqueeProps = React.ComponentProps<"section"> & {
  direction?: MarqueeDirection;
  speed?: MarqueeSpeed;
  /** Override the named pace with 0–160 CSS pixels per second. */
  pixelsPerSecond?: number;
  respondToScroll?: boolean;
  /** Omit to follow document scrolling. The target should be mounted with the marquee. */
  scrollTarget?: React.RefObject<HTMLElement | null>;
  presentation?: "flat" | "depth";
  /** Depth presentation only. Perspective also scales to the viewport to keep the strip continuous. */
  tiltX?: number;
  tiltY?: number;
  perspective?: number;
  depth?: number;
  label?: string;
  paused?: boolean;
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
};
const interactiveSelector = 'a[href],button,input,select,textarea,[contenteditable="true"],[tabindex]:not([tabindex="-1"])';
const bounded = (value: number, fallback: number, low: number, high: number) => Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback;

/** One semantic list. Decorative copies never mount React effects or duplicate IDs. */
export function Marquee({ children, direction = "left", speed = "slow", pixelsPerSecond, respondToScroll = false, scrollTarget,
  presentation = "flat", tiltX = 4, tiltY = -18, perspective = 1000, depth = .65,
  label = "Highlights", paused, defaultPaused = false, onPausedChange,
  className, style, ref, onPointerEnter, onPointerLeave, onFocusCapture, onBlurCapture, ...props }: MarqueeProps) {
  const root = React.useRef<HTMLElement>(null), viewport = React.useRef<HTMLDivElement>(null), track = React.useRef<HTMLDivElement>(null);
  const source = React.useRef<HTMLUListElement>(null), copy = React.useRef<HTMLUListElement>(null), leadingCopy = React.useRef<HTMLUListElement>(null);
  const outerLeadingCopy = React.useRef<HTMLUListElement>(null), outerCopy = React.useRef<HTMLUListElement>(null);
  const attach = React.useCallback((node: HTMLElement | null) => { root.current = node; return assignMotionRef(ref, node); }, [ref]);
  const { enabled, inView, quiet } = useGuidanceMotion(root);
  const [localPaused, setLocalPaused] = React.useState(defaultPaused);
  const [hovered, setHovered] = React.useState(false), [focused, setFocused] = React.useState(false), [contentFocused, setContentFocused] = React.useState(false);
  const [interactive, setInteractive] = React.useState(false);
  const [measurement, setMeasurement] = React.useState({ period: 0, width: 0 });
  const positions = React.useRef<{ node: HTMLElement; midpoint: number }[]>([]);
  const motion = React.useRef<MarqueeMotion>({ phase: 0, velocity: 0, scrollVelocity: 0, scrollDirection: 1 });
  const id = React.useId(), manuallyPaused = paused ?? localPaused;
  const still = quiet || interactive || contentFocused;
  const pace = pixelsPerSecond === undefined ? measurement.period / (speed === "fast" ? 18 : speed === "normal" ? 30 : 44) : bounded(pixelsPerSecond, 28, 0, 160);
  const running = inView && enabled && !still && !manuallyPaused && !hovered && !focused && measurement.period > 0 && pace > 0;
  const settings = React.useRef({ pace, direction, respondToScroll, presentation, depth });
  React.useEffect(() => {
    if (settings.current.direction !== direction) motion.current.scrollDirection = 1;
    settings.current = { pace, direction, respondToScroll, presentation, depth };
  }, [pace, direction, respondToScroll, presentation, depth]);

  React.useEffect(() => {
    const list = source.current, duplicate = copy.current, leading = leadingCopy.current, outerLeading = outerLeadingCopy.current, outerTrailing = outerCopy.current, windowElement = viewport.current, element = root.current;
    if (!list || !duplicate || !leading || !outerLeading || !outerTrailing || !windowElement || !element) return;
    const copies = [outerLeading, leading, duplicate, outerTrailing];
    let frame = 0, mirrorFrame = 0, disposed = false;
    const measure = () => {
      frame = 0;
      if (disposed) return;
      const width = windowElement.clientWidth;
      const cssWidth = `${width}px`;
      if (element.style.getPropertyValue("--marquee-viewport") !== cssWidth) element.style.setProperty("--marquee-viewport", cssWidth);
      const period = list.getBoundingClientRect().width;
      // offsetWidth is independent of the stage's authored perspective transform.
      const layoutPeriod = list.offsetWidth || period;
      motion.current.phase = layoutPeriod > 0 ? motion.current.phase % layoutPeriod : 0;
      positions.current = [outerLeading, leading, list, duplicate, outerTrailing].flatMap((parent, index) => Array.from(parent.children, node => ({ node: node as HTMLElement, midpoint: index * layoutPeriod + (node as HTMLElement).offsetLeft + (node as HTMLElement).offsetWidth / 2 })));
      setMeasurement(old => old.period === layoutPeriod && old.width === width ? old : { period: layoutPeriod, width });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const mirror = () => {
      mirrorFrame = 0;
      const nodes = Array.from(list.children, child => child.cloneNode(true) as HTMLElement);
      for (const node of nodes) for (const part of [node, ...node.querySelectorAll<HTMLElement>("*")]) {
        for (const attribute of ["id", "name", "for", "form", "aria-labelledby", "aria-describedby", "aria-controls", "aria-owns"]) part.removeAttribute(attribute);
        if (part.matches(interactiveSelector)) part.tabIndex = -1;
      }
      for (const target of copies) target.replaceChildren(...nodes.map(node => node.cloneNode(true)));
      // A static original list keeps real controls usable without inert lookalikes.
      setInteractive(Boolean(list.querySelector(interactiveSelector)));
      element.dataset.ready = "true";
      schedule();
    };
    mirror();
    const mutation = new MutationObserver(records => {
      // Depth paint owns the immediate li style. Authored child attributes still
      // need to reach the copies, including links becoming interactive in place.
      const authored = records.some(record => !(record.type === "attributes" && record.attributeName === "style" && record.target.parentNode === list));
      if (authored && !mirrorFrame) mirrorFrame = requestAnimationFrame(mirror);
    });
    mutation.observe(list, { childList: true, characterData: true, subtree: true, attributes: true,
      attributeFilter: ["href", "tabindex", "contenteditable", "disabled", "src", "srcset", "alt", "title", "class", "style", "role", "aria-label", "aria-checked", "aria-pressed"] });
    const resize = new ResizeObserver(schedule); resize.observe(windowElement); resize.observe(list);
    document.fonts.ready.then(() => { if (!disposed) schedule(); });
    document.fonts.addEventListener("loadingdone", schedule);
    return () => { disposed = true; if (frame) cancelAnimationFrame(frame); if (mirrorFrame) cancelAnimationFrame(mirrorFrame); mutation.disconnect(); resize.disconnect(); document.fonts.removeEventListener("loadingdone", schedule); for (const target of copies) target.replaceChildren(); positions.current = []; delete element.dataset.ready; };
  }, [children]);

  React.useEffect(() => {
    if (!running || !respondToScroll) return;
    const target = scrollTarget?.current ?? window;
    const read = () => target instanceof HTMLElement ? target.scrollTop : window.scrollY;
    let y = read(), time = performance.now();
    const update = () => { const next = read(), now = performance.now(); motion.current.scrollVelocity = marqueeScrollVelocity(next - y, (now - time) / 1000); y = next; time = now; };
    target.addEventListener("scroll", update, { passive: true });
    return () => { target.removeEventListener("scroll", update); motion.current.scrollVelocity = 0; };
  }, [running, respondToScroll, scrollTarget]);

  React.useEffect(() => {
    const node = track.current;
    if (!node) return;
    const paint = () => {
      // Two periods on each side cover both projected edges throughout a wrap.
      const offset = 2 * measurement.period + motion.current.phase;
      node.style.setProperty("--marquee-transform", `translate3d(${-offset}px, 0, 0)`);
      for (const item of positions.current) {
        const focus = settings.current.presentation === "depth" ? marqueeDepth(item.midpoint - offset, measurement.width, settings.current.depth) : { blur: 0, opacity: 1 };
        item.node.style.setProperty("--marquee-item-filter", focus.blur ? `blur(${focus.blur.toFixed(2)}px)` : "none");
        item.node.style.setProperty("--marquee-item-opacity", String(focus.opacity));
      }
    };
    paint();
    if (!running) { motion.current.velocity = 0; return; }
    let frame = 0, previous: number | undefined;
    const tick = (time: number) => {
      const delta = previous === undefined ? 0 : (time - previous) / 1000;
      previous = time;
      const current = settings.current;
      motion.current = advanceMarquee(motion.current, delta, current.pace * (current.direction === "left" ? 1 : -1), measurement.period, current.respondToScroll);
      paint(); frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, measurement, presentation, depth]);

  const status = quiet ? "Motion is off" : interactive ? "Interactive list" : manuallyPaused ? "Paused" : focused ? "Paused while focused" : hovered ? "Paused while hovered" : running ? "Moving" : "Paused";
  return <section {...props} ref={attach} data-slot="marquee" data-direction={direction} data-speed={speed}
    data-presentation={presentation} data-scroll-responsive={respondToScroll || undefined} data-motion={still ? "static" : running ? "running" : "paused"} data-content-focused={contentFocused || undefined}
    aria-labelledby={props["aria-labelledby"] ?? (props["aria-label"] ? undefined : `${id}-label`)} className={cn("v-marquee", className)}
    style={{ ...style, "--marquee-tilt-x": `${bounded(tiltX, 4, -15, 15)}deg`, "--marquee-tilt-y": `${bounded(tiltY, -18, -30, 30)}deg`, "--marquee-perspective": `max(${bounded(perspective, 1000, 500, 2000)}px, var(--marquee-viewport, 0px))` } as React.CSSProperties}
    onPointerEnter={event => { onPointerEnter?.(event); if (!event.defaultPrevented && event.pointerType !== "touch") setHovered(true); }}
    onPointerLeave={event => { onPointerLeave?.(event); setHovered(false); }}
    onFocusCapture={event => { onFocusCapture?.(event); setFocused(true); setContentFocused(Boolean(source.current?.contains(event.target))); }}
    onBlurCapture={event => { onBlurCapture?.(event); const next = event.relatedTarget; setFocused(next instanceof Node && event.currentTarget.contains(next)); setContentFocused(next instanceof Node && Boolean(source.current?.contains(next))); }}>
    <div data-slot="marquee-header"><Meta as="span" id={`${id}-label`}>{label}</Meta><div data-slot="marquee-controls">
      <Meta as="span" data-slot="marquee-status" role="status">{status}</Meta>
      <Button size="sm" variant="ghost" disabled={quiet || interactive} aria-controls={`${id}-viewport`} onClick={() => { if (paused === undefined) setLocalPaused(!manuallyPaused); onPausedChange?.(!manuallyPaused); }}>{quiet || interactive ? "Motion paused" : manuallyPaused ? "Resume motion" : "Pause motion"}</Button>
    </div></div>
    <div ref={viewport} data-slot="marquee-viewport" id={`${id}-viewport`}><div data-slot="marquee-stage"><div ref={track} data-slot="marquee-track">
      <ul ref={outerLeadingCopy} data-slot="marquee-copy" data-copy-position="before-outer" aria-hidden="true" inert />
      <ul ref={leadingCopy} data-slot="marquee-copy" data-copy-position="before" aria-hidden="true" inert />
      <ul ref={source} data-slot="marquee-content">{React.Children.toArray(children).map((child, index) => <li key={React.isValidElement(child) ? child.key ?? index : index}>{child}</li>)}</ul>
      <ul ref={copy} data-slot="marquee-copy" data-copy-position="after" aria-hidden="true" inert />
      <ul ref={outerCopy} data-slot="marquee-copy" data-copy-position="after-outer" aria-hidden="true" inert />
    </div></div></div>
  </section>;
}
