"use client";

import { Moon, Sun } from "lucide-react";

/** `compact`: icon only (collapsed sidebar rail). */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  function toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {
      // Storage blocked (private mode) — theme still switches for this visit.
    }
  }

  // Label/icon follow the html class via CSS, so no hydration mismatch.
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Ganti mode tampilan"
      title={compact ? "Ganti mode terang/gelap" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border bg-muted font-semibold text-foreground transition-colors hover:bg-card-inner dark:text-muted-foreground ${compact ? "size-11 justify-center" : "h-10 px-3 text-xs"}`}
    >
      <Moon className="hidden size-4 text-primary dark:block" />
      <Sun className="size-4 text-primary dark:hidden" />
      {!compact && (
        <>
          <span className="hidden sm:inline sm:dark:hidden">Mode Terang</span>
          <span className="hidden sm:dark:inline">Mode Gelap</span>
        </>
      )}
    </button>
  );
}
