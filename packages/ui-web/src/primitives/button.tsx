"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "../icons";
import { cx } from "../lib/cx";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "quiet";
export type ButtonSize = "sm" | "md" | "lg";

export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cx("mp-button", `mp-button--${variant}`, `mp-button--${size}`, className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel = "Đang xử lý…",
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  className,
  children,
  disabled,
  type,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading ? "" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cx(buttonClassName(variant, size), fullWidth && "mp-button--block", className)}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="mp-spinner" aria-hidden="true" />
      ) : leadingIcon ? (
        <span className="mp-button__icon" aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}
      <span className="mp-button__label">{children}</span>
      {!loading && trailingIcon ? (
        <span className="mp-button__icon" aria-hidden="true">
          {trailingIcon}
        </span>
      ) : null}
      {loading ? <span className="mp-visually-hidden">{loadingLabel}</span> : null}
    </button>
  );
}

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function IconButton({
  label,
  variant = "quiet",
  size = "md",
  className,
  children,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      data-slot="icon-button"
      className={cx("mp-icon-button", `mp-icon-button--${variant}`, `mp-icon-button--${size}`, className)}
      {...props}
    >
      {children}
    </button>
  );
}
