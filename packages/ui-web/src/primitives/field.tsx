"use client";

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Check } from "../icons";
import { cx } from "../lib/cx";

interface FieldMessages {
  hint?: ReactNode;
  error?: string;
}

function FieldMessages({ id, hint, error }: FieldMessages & { id: string }) {
  if (error) {
    return (
      <span className="mp-field__error" id={`${id}-error`} role="alert">
        {error}
      </span>
    );
  }
  if (hint) {
    return (
      <span className="mp-field__hint" id={`${id}-hint`}>
        {hint}
      </span>
    );
  }
  return null;
}

function descriptionId(id: string, hint?: ReactNode, error?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

function FieldLabel({
  htmlFor,
  label,
  required,
  optional,
}: {
  htmlFor: string;
  label: ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label className="mp-field__label" htmlFor={htmlFor} data-slot="field-label">
      <span>{label}</span>
      {required ? (
        <span className="mp-field__required" aria-hidden="true">
          *
        </span>
      ) : null}
      {optional ? <span className="mp-field__optional">(không bắt buộc)</span> : null}
    </label>
  );
}

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & FieldMessages & {
  label: string;
  optional?: boolean;
  containerClassName?: string;
};

export function TextField({
  label,
  hint,
  error,
  optional,
  containerClassName,
  className,
  id,
  name,
  required,
  ...props
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? name ?? autoId;
  return (
    <div className={cx("mp-field", containerClassName)} data-slot="field">
      <FieldLabel htmlFor={inputId} label={label} required={required} optional={optional} />
      <input
        id={inputId}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={descriptionId(inputId, hint, error)}
        className={cx("mp-field__input", className)}
        data-slot="input"
        {...props}
      />
      <FieldMessages id={inputId} hint={hint} error={error} />
    </div>
  );
}

export type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldMessages & {
  label: string;
  optional?: boolean;
  containerClassName?: string;
};

export function TextareaField({
  label,
  hint,
  error,
  optional,
  containerClassName,
  className,
  id,
  name,
  required,
  rows = 4,
  ...props
}: TextareaFieldProps) {
  const autoId = useId();
  const inputId = id ?? name ?? autoId;
  return (
    <div className={cx("mp-field", containerClassName)} data-slot="field">
      <FieldLabel htmlFor={inputId} label={label} required={required} optional={optional} />
      <textarea
        id={inputId}
        name={name}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={descriptionId(inputId, hint, error)}
        className={cx("mp-field__input", "mp-field__textarea", className)}
        data-slot="textarea"
        {...props}
      />
      <FieldMessages id={inputId} hint={hint} error={error} />
    </div>
  );
}

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & FieldMessages & {
  label: string;
  optional?: boolean;
  placeholder?: string;
  containerClassName?: string;
  children: ReactNode;
};

export function SelectField({
  label,
  hint,
  error,
  optional,
  placeholder,
  containerClassName,
  className,
  id,
  name,
  required,
  children,
  ...props
}: SelectFieldProps) {
  const autoId = useId();
  const inputId = id ?? name ?? autoId;
  return (
    <div className={cx("mp-field", containerClassName)} data-slot="field">
      <FieldLabel htmlFor={inputId} label={label} required={required} optional={optional} />
      <select
        id={inputId}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={descriptionId(inputId, hint, error)}
        className={cx("mp-field__input", "mp-field__select", className)}
        data-slot="select"
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {children}
      </select>
      <FieldMessages id={inputId} hint={hint} error={error} />
    </div>
  );
}

export type CheckboxFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  description?: ReactNode;
  error?: string;
  containerClassName?: string;
};

export function CheckboxField({
  label,
  description,
  error,
  containerClassName,
  className,
  id,
  required,
  ...props
}: CheckboxFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={cx("mp-checkbox-field", containerClassName)} data-slot="checkbox-field">
      <label className="mp-checkbox" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={descriptionId(inputId, description, error)}
          className={cx("mp-checkbox__input", className)}
          {...props}
        />
        <span className="mp-checkbox__box" aria-hidden="true">
          <Check size={14} strokeWidth={3} />
        </span>
        <span className="mp-checkbox__text">
          <span className="mp-checkbox__label">{label}</span>
          {description ? (
            <span className="mp-checkbox__description" id={`${inputId}-hint`}>
              {description}
            </span>
          ) : null}
        </span>
      </label>
      {error ? (
        <span className="mp-field__error" id={`${inputId}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function SwitchField({
  label,
  description,
  id,
  containerClassName,
  ...props
}: CheckboxFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={cx("mp-switch-field", containerClassName)} data-slot="switch-field">
      <label className="mp-switch" htmlFor={inputId}>
        <span className="mp-switch__text">
          <span className="mp-switch__label">{label}</span>
          {description ? <span className="mp-checkbox__description">{description}</span> : null}
        </span>
        <input id={inputId} type="checkbox" className="mp-switch__input" {...props} />
        <span className="mp-switch__track" aria-hidden="true">
          <span className="mp-switch__thumb" />
        </span>
      </label>
    </div>
  );
}
