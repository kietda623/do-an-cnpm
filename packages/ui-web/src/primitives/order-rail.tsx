import type { CSSProperties } from "react";
import { cx } from "../lib/cx";

export type RailTone = "neutral" | "active" | "done" | "warn" | "danger";

export type RailStep = {
  id: string;
  label: string;
  meta?: string;
  tone?: RailTone;
};

export type OrderRailProps = {
  steps: RailStep[];
  label: string;
  currentId?: string;
  orientation?: "horizontal" | "vertical";
  className?: string;
};

export function OrderRail({
  steps,
  label,
  currentId,
  orientation = "horizontal",
  className,
}: OrderRailProps) {
  return (
    <ol
      className={cx("mp-rail", orientation === "vertical" && "mp-rail--vertical", className)}
      aria-label={label}
      data-slot="order-rail"
    >
      {steps.map((step, index) => {
        const current = step.id === currentId;
        const style = { "--rail-index": index } as CSSProperties;
        return (
          <li
            key={step.id}
            className="mp-rail__step"
            data-tone={step.tone ?? "neutral"}
            aria-current={current ? "step" : undefined}
            style={style}
          >
            <span className="mp-rail__node" aria-hidden="true" />
            <span className="mp-rail__body">
              <span className="mp-rail__label">{step.label}</span>
              {step.meta ? <span className="mp-rail__meta">{step.meta}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
