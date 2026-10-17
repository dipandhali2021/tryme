"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  ThemeToggle,
  applyTheme,
  type ThemeChangeDetails,
  type ThemeMode,
} from "@/components/ui/theme-toggle";

const STORAGE_KEY = "tryme-mode";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readStoredMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // storage unavailable — keep the dark default
  }
  return "dark";
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function SiteHeader() {
  // Mirrors localStorage without a hydration mismatch: the server snapshot is
  // the dark default; the client re-reads right after hydration.
  const mode = useSyncExternalStore<ThemeMode>(
    subscribe,
    readStoredMode,
    () => "dark",
  );

  function handleModeChange(next: ThemeMode, details?: ThemeChangeDetails) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable — theme still applies for this session
    }
    emit();
    applyTheme(next, false, undefined, details ? { origin: details.origin } : undefined);
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-s-4 border-b border-border/60 bg-background/80 px-s-6 py-s-3 backdrop-blur">
      <Link href="/" className="flex items-baseline gap-s-2">
        <span className="font-heading text-v-title font-weight-v-semibold tracking-tight">
          TryMe
        </span>
        <span className="hidden text-v-small text-muted-foreground sm:inline">
          live virtual try-on
        </span>
      </Link>
      <nav className="flex items-center gap-s-3">
        <Link
          href="/studio"
          className="text-v-control text-muted-foreground transition-colors hover:text-foreground"
        >
          Studio
        </Link>
        <ThemeToggle mode={mode} onModeChange={handleModeChange} showLabel={false} />
      </nav>
    </header>
  );
}
