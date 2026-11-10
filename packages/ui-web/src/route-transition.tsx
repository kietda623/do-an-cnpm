"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function RouteTransition() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("mp-route-enter");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let enterFrame = 0;
    let timer = 0;
    const frame = window.requestAnimationFrame(() => {
      enterFrame = window.requestAnimationFrame(() => {
        root.classList.add("mp-route-enter");
        timer = window.setTimeout(
          () => root.classList.remove("mp-route-enter"),
          320,
        );
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(enterFrame);
      window.clearTimeout(timer);
      root.classList.remove("mp-route-enter");
    };
  }, [pathname]);

  return null;
}
