"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { Monitor, Moon, Sun } from "./icons";
import { isThemeMode, resolveTheme, THEME_STORAGE_KEY, type ThemeMode } from "./theme";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

type PseudoKeyframeOptions = KeyframeAnimationOptions & { pseudoElement: string };

const modes: ThemeMode[] = ["system", "light", "dark"];

const labels: Record<ThemeMode, string> = {
  system: "Chuyển sang giao diện sáng",
  light: "Chuyển sang giao diện tối",
  dark: "Chuyển sang giao diện theo hệ thống",
};

function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function applyTheme(mode: ThemeMode, origin?: { x: number; y: number }) {
  const root = document.documentElement;
  const resolved = resolveTheme(mode, prefersDark());
  const update = () => {
    root.dataset.theme = resolved;
    root.dataset.themeMode = mode;
  };

  const doc = document as ViewTransitionDocument;
  if (!doc.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }

  const transition = doc.startViewTransition(update);
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? 0;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  void transition.ready.then(() => {
    const options: PseudoKeyframeOptions = {
      duration: 520,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      pseudoElement: "::view-transition-new(root)",
    };
    root.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${radius}px at ${x}px ${y}px)`,
        ],
      },
      options,
    );
  });
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeMode(stored)) setMode(stored);
    } catch {
      // Storage can be unavailable (private mode); keep the system default.
    }
  }, []);

  useEffect(() => {
    applyTheme(mode);
    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  const cycle = (event: MouseEvent<HTMLButtonElement>) => {
    const next = modes[(modes.indexOf(mode) + 1) % modes.length]!;
    setMode(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Persisting the preference is best-effort.
    }
    applyTheme(next, { x: event.clientX, y: event.clientY });
  };

  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      className={className ? `mp-theme-toggle ${className}` : "mp-theme-toggle"}
      onClick={cycle}
      aria-label={labels[mode]}
      title={labels[mode]}
      data-theme-mode={mode}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="mp-theme-toggle__label">
        {mode === "light" ? "Sáng" : mode === "dark" ? "Tối" : "Tự động"}
      </span>
    </button>
  );
}
