"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function RouteTransition() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("mp-route-enter");
    void root.offsetWidth;
    root.classList.add("mp-route-enter");
    const timer = window.setTimeout(() => root.classList.remove("mp-route-enter"), 700);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
