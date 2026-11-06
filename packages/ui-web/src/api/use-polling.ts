"use client";

import { useEffect, useRef } from "react";
import { createPollGate } from "./poll-gate";

export type PollingRefresh = (options?: { silent?: boolean }) => Promise<unknown> | unknown;

export type PollingOptions = {
  intervalMs: number;
  enabled?: boolean;
  pauseWhile?: boolean;
};

export function usePolling(
  refresh: PollingRefresh,
  { intervalMs, enabled = true, pauseWhile = false }: PollingOptions,
): void {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled || pauseWhile || intervalMs <= 0) return;

    const gate = createPollGate(() => refreshRef.current({ silent: true }));
    const isHidden = () => document.visibilityState === "hidden";
    gate.setState({ hidden: isHidden() });

    const onVisibilityChange = () => {
      const hidden = isHidden();
      gate.setState({ hidden });
      if (!hidden) gate.tick();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    const timer = window.setInterval(() => {
      gate.tick();
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, intervalMs, pauseWhile]);
}
