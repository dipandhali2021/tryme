"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ThemeToggle,
  applyTheme,
  type ThemeChangeDetails,
  type ThemeMode,
} from "@/components/ui/theme-toggle";

const STORAGE_KEY = "tryme-mode";

export function SiteHeader() {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") setMode(stored);
    } catch {
      // storage unavailable — keep the dark default
    }
  }, []);

  function handleModeChange(next: ThemeMode, details?: ThemeChangeDetails) {
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable — theme still applies for this session
    }
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
