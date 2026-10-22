import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const classes = [
    "mp-button inline-flex min-h-11 items-center justify-center gap-control-gap rounded-marketplace-control px-4 py-2.5 font-semibold focus-visible:ring-2 focus-visible:ring-marketplace-ring disabled:cursor-not-allowed disabled:opacity-55",
    `mp-button--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button data-slot="button" className={classes} {...props} />;
}

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function TextField({ id, label, error, className, ...props }: TextFieldProps) {
  const inputId = id ?? props.name;
  const errorId = error && inputId ? `${inputId}-error` : undefined;
  const classes = ["mp-field__input", className].filter(Boolean).join(" ");

  return (
    <div className="mp-field grid gap-1.5">
      <label
        className="mp-field__label text-sm font-semibold"
        htmlFor={inputId}
        data-slot="field-label"
      >
        {label}
      </label>
      <input
        id={inputId}
        data-slot="input"
        className={`${classes} min-h-11 w-full rounded-marketplace-control border border-marketplace-border bg-marketplace-background px-3 py-2.5 text-marketplace-foreground aria-invalid:border-marketplace-danger`}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        {...props}
      />
      {error && (
        <span
          className="mp-field__error text-sm text-marketplace-danger"
          id={errorId}
          role="alert"
          data-slot="field-error"
        >
          {error}
        </span>
      )}
    </div>
  );
}

export function FormSection({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <section className="mp-form-section grid gap-4" aria-label={title} data-slot="form-section">
      {title && <h2 className="mp-form-section__title text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}
