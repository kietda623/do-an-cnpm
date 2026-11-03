"use client";

import { useId, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from "../icons";
import { cx } from "../lib/cx";
import { formatNumber } from "../lib/format";
import type { Tone } from "../lib/status";

export type PanelProps = {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
  tone?: "default" | "danger";
};

export function Panel({
  title,
  description,
  actions,
  footer,
  children,
  className,
  bodyClassName,
  flush = false,
  tone = "default",
}: PanelProps) {
  const headingId = useId();
  return (
    <section
      className={cx("mp-panel", tone === "danger" && "mp-panel--danger", className)}
      aria-labelledby={title ? headingId : undefined}
      data-slot="panel"
    >
      {title || actions ? (
        <header className="mp-panel__header">
          <div className="mp-panel__heading">
            {title ? (
              <h2 className="mp-panel__title" id={headingId}>
                {title}
              </h2>
            ) : null}
            {description ? <p className="mp-panel__description">{description}</p> : null}
          </div>
          {actions ? <div className="mp-panel__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cx("mp-panel__body", flush && "mp-panel__body--flush", bodyClassName)}>{children}</div>
      {footer ? <footer className="mp-panel__footer">{footer}</footer> : null}
    </section>
  );
}

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({ title, description, actions, meta }: PageHeaderProps) {
  return (
    <div className="mp-page-header" data-slot="page-header">
      <div className="mp-page-header__text">
        <h1 className="mp-page-header__title">{title}</h1>
        {description ? <p className="mp-page-header__description">{description}</p> : null}
        {meta ? <div className="mp-page-header__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="mp-page-header__actions">{actions}</div> : null}
    </div>
  );
}

export type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
};

export function StatCard({ label, value, detail, icon, tone = "accent" }: StatCardProps) {
  return (
    <div className="mp-stat" data-slot="stat-card">
      <div className="mp-stat__top">
        <span className="mp-stat__label">{label}</span>
        {icon ? (
          <span className={cx("mp-stat__icon", `mp-stat__icon--${tone}`)} aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <span className="mp-stat__value" data-numeric>
        {value}
      </span>
      {detail ? <span className="mp-stat__detail">{detail}</span> : null}
    </div>
  );
}

export type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cx("mp-empty", className)} data-slot="empty-state">
      {icon ? (
        <span className="mp-empty__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className="mp-empty__title">{title}</p>
      {description ? <p className="mp-empty__description">{description}</p> : null}
      {action ? <div className="mp-empty__action">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cx("mp-skeleton", className)} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <span className="mp-skeleton-text" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          className="mp-skeleton mp-skeleton--line"
          style={{ width: index === lines - 1 ? "62%" : "100%" }}
        />
      ))}
    </span>
  );
}

export type AvatarProps = {
  name?: string | null;
  src?: string | null;
  size?: "sm" | "md" | "lg";
};

function initials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0] ?? ""}${words[words.length - 1]![0] ?? ""}`.toUpperCase();
}

export function Avatar({ name, src, size = "md" }: AvatarProps) {
  return (
    <span className={cx("mp-avatar", `mp-avatar--${size}`)} data-slot="avatar">
      {src ? <img src={src} alt="" className="mp-avatar__image" /> : initials(name)}
    </span>
  );
}

export type BreadcrumbItem = {
  label: ReactNode;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="mp-breadcrumbs" aria-label="Đường dẫn">
      <ol>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={index}>
              {item.href && !current ? (
                <a href={item.href}>{item.label}</a>
              ) : (
                <span aria-current={current ? "page" : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type TabItem = {
  key: string;
  label: string;
  count?: number;
  href?: string;
};

export type TabsProps = {
  items: TabItem[];
  value: string;
  onChange?: (key: string) => void;
  label?: string;
};

export function Tabs({ items, value, onChange, label = "Bộ lọc trạng thái" }: TabsProps) {
  const usesLinks = items.every((item) => item.href);
  if (usesLinks) {
    return (
      <nav className="mp-tabs" aria-label={label} data-slot="tabs">
        {items.map((item) => {
          const active = item.key === value;
          return (
            <a
              key={item.key}
              href={item.href}
              className={cx("mp-tab", active && "mp-tab--active")}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
              {typeof item.count === "number" ? (
                <span className="mp-tab__count" data-numeric>
                  {formatNumber(item.count)}
                </span>
              ) : null}
            </a>
          );
        })}
      </nav>
    );
  }
  return (
    <div className="mp-tabs" role="tablist" aria-label={label} data-slot="tabs">
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx("mp-tab", active && "mp-tab--active")}
            onClick={() => onChange?.(item.key)}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span className="mp-tab__count" data-numeric>
                {formatNumber(item.count)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export type PaginationProps = {
  page: number;
  pageCount: number;
  total?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  hrefForPage?: (page: number) => string;
};

function pageWindow(page: number, pageCount: number): Array<number | "gap"> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const result: Array<number | "gap"> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - (sorted[index - 1] as number) > 1) result.push("gap");
    result.push(value);
  });
  return result;
}

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  hrefForPage,
}: PaginationProps) {
  if (pageCount <= 1) return null;
  const pages = pageWindow(page, pageCount);

  const target = (targetPage: number, className: string, children: ReactNode, disabled = false) => {
    if (hrefForPage && !disabled) {
      return (
        <a className={className} href={hrefForPage(targetPage)}>
          {children}
        </a>
      );
    }
    return (
      <button
        type="button"
        className={className}
        onClick={() => onPageChange?.(targetPage)}
        disabled={disabled}
      >
        {children}
      </button>
    );
  };

  return (
    <nav className="mp-pagination" aria-label="Phân trang" data-slot="pagination">
      {total !== undefined ? (
        <p className="mp-pagination__summary">
          {pageSize ? `${formatNumber(total)} kết quả · ${pageSize} mỗi trang` : `${formatNumber(total)} kết quả`}
        </p>
      ) : null}
      <div className="mp-pagination__controls">
        {target(page - 1, "mp-pagination__step", "Trước", page <= 1)}
        {pages.map((value, index) =>
          value === "gap" ? (
            <span key={`gap-${index}`} className="mp-pagination__gap" aria-hidden="true">
              …
            </span>
          ) : hrefForPage ? (
            <a
              key={value}
              href={hrefForPage(value)}
              className={cx("mp-pagination__page", value === page && "mp-pagination__page--active")}
              aria-current={value === page ? "page" : undefined}
            >
              {value}
            </a>
          ) : (
            <button
              key={value}
              type="button"
              className={cx("mp-pagination__page", value === page && "mp-pagination__page--active")}
              aria-current={value === page ? "page" : undefined}
              onClick={() => onPageChange?.(value)}
            >
              {value}
            </button>
          ),
        )}
        {target(page + 1, "mp-pagination__step", "Sau", page >= pageCount)}
      </div>
    </nav>
  );
}

export type StatusMessageTone = "success" | "error" | "info" | "warning";

const statusMessageIcons: Record<StatusMessageTone, LucideIcon> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: TriangleAlert,
};

export type StatusMessageProps = {
  tone?: StatusMessageTone;
  title?: ReactNode;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
};

export function StatusMessage({
  tone = "info",
  title,
  children,
  onDismiss,
  className,
}: StatusMessageProps) {
  const Icon = statusMessageIcons[tone];
  return (
    <div
      className={cx("mp-alert", `mp-alert--${tone}`, className)}
      role={tone === "error" ? "alert" : "status"}
      data-slot="status-message"
    >
      <Icon className="mp-alert__icon" aria-hidden="true" />
      <div className="mp-alert__body">
        {title ? <p className="mp-alert__title">{title}</p> : null}
        <div className="mp-alert__text">{children}</div>
      </div>
      {onDismiss ? (
        <button type="button" className="mp-alert__dismiss" onClick={onDismiss} aria-label="Đóng thông báo">
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
