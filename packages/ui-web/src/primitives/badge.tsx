import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import { statusOf, type StatusMap, type Tone } from "../lib/status";

export type BadgeProps = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
};

export function Badge({ children, tone = "neutral", className, dot = false }: BadgeProps) {
  return (
    <span className={cx("mp-badge", `mp-badge--${tone}`, className)} data-slot="badge">
      {dot ? <span className="mp-badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export type StatusBadgeProps = {
  status: string | null | undefined;
  map: StatusMap;
  label?: string;
  className?: string;
};

export function StatusBadge({ status, map, label, className }: StatusBadgeProps) {
  const meta = statusOf(map, status);
  return (
    <Badge tone={meta.tone} className={className} dot>
      {label ?? meta.label}
    </Badge>
  );
}
