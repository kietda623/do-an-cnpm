import type { ReactNode } from "react";
import { EmptyState } from "../primitives/surface";
import { cx } from "../lib/cx";
import { formatNumber } from "../lib/format";

export type ChartPoint = {
  label: string;
  value: number;
  caption?: string;
};

export type ChartProps = {
  data: ChartPoint[];
  label: string;
  valueFormat?: (value: number) => string;
  height?: number;
  className?: string;
  emptyText?: ReactNode;
  caption?: string;
};

function chartTable(data: ChartPoint[], label: string, valueFormat: (value: number) => string, caption?: string) {
  return (
    <table className="mp-visually-hidden">
      <caption>{caption ?? label}</caption>
      <thead>
        <tr>
          <th scope="col">Kỳ</th>
          <th scope="col">Giá trị</th>
        </tr>
      </thead>
      <tbody>
        {data.map((point, index) => (
          <tr key={`${point.label}-${index}`}>
            <td>{point.label}</td>
            <td>{valueFormat(point.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BarChart({
  data,
  label,
  valueFormat = formatNumber,
  height = 200,
  className,
  emptyText = "Chưa có dữ liệu để hiển thị.",
  caption,
}: ChartProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Chưa có dữ liệu"
        description={emptyText}
        className={cx("mp-chart-empty", className)}
      />
    );
  }
  const max = Math.max(...data.map((point) => point.value), 1);
  const showEvery = data.length > 14 ? Math.ceil(data.length / 8) : 1;

  return (
    <figure className={cx("mp-chart", className)} aria-label={label} data-slot="bar-chart">
      <div className="mp-chart__bars" style={{ height }}>
        {data.map((point, index) => {
          const ratio = Math.max(point.value / max, 0);
          const visibleLabel = index % showEvery === 0 || index === data.length - 1;
          return (
            <div className="mp-chart__column" key={`${point.label}-${index}`}>
              <span className="mp-chart__value" data-numeric>
                {point.value > 0 && data.length <= 14 ? valueFormat(point.value) : ""}
              </span>
              <span
                className="mp-chart__bar"
                style={{ height: `${Math.max(ratio * 100, point.value > 0 ? 2 : 0)}%` }}
                title={`${point.label}: ${valueFormat(point.value)}`}
                aria-hidden="true"
              />
              <span className={cx("mp-chart__label", !visibleLabel && "mp-chart__label--hidden")}>
                <span aria-hidden={!visibleLabel}>{point.label}</span>
              </span>
            </div>
          );
        })}
      </div>
      {caption ? <figcaption className="mp-chart__caption">{caption}</figcaption> : null}
      {chartTable(data, label, valueFormat, caption)}
    </figure>
  );
}

export function AreaChart({
  data,
  label,
  valueFormat = formatNumber,
  height = 200,
  className,
  emptyText = "Chưa có dữ liệu để hiển thị.",
  caption,
}: ChartProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Chưa có dữ liệu"
        description={emptyText}
        className={cx("mp-chart-empty", className)}
      />
    );
  }
  const width = 600;
  const chartHeight = 200;
  const padding = 8;
  const max = Math.max(...data.map((point) => point.value), 1);
  const step = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
  const points = data.map((point, index) => {
    const x = padding + step * index;
    const y = chartHeight - padding - (point.value / max) * (chartHeight - padding * 2);
    return { x, y, point };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padding},${chartHeight - padding} ${line} ${width - padding},${chartHeight - padding}`;
  const showEvery = data.length > 14 ? Math.ceil(data.length / 8) : 1;

  return (
    <figure className={cx("mp-chart", className)} aria-label={label} data-slot="area-chart">
      <div className="mp-chart__plot" style={{ height }}>
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          preserveAspectRatio="none"
          className="mp-chart__svg"
          aria-hidden="true"
          focusable="false"
        >
          <polygon points={area} className="mp-chart__area" />
          <polyline points={line} className="mp-chart__line" vectorEffect="non-scaling-stroke" />
          {points.map((point, index) => (
            <circle
              key={`${point.point.label}-${index}`}
              cx={point.x}
              cy={point.y}
              r={2.5}
              className="mp-chart__dot"
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${point.point.label}: ${valueFormat(point.point.value)}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="mp-chart__axis">
        {data.map((point, index) => (
          <span
            key={`${point.label}-${index}`}
            className={cx(
              "mp-chart__label",
              index % showEvery !== 0 && index !== data.length - 1 && "mp-chart__label--hidden",
            )}
          >
            {point.label}
          </span>
        ))}
      </div>
      {caption ? <figcaption className="mp-chart__caption">{caption}</figcaption> : null}
      {chartTable(data, label, valueFormat, caption)}
    </figure>
  );
}
