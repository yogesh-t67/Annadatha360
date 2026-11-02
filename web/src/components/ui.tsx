"use client";

import clsx from "clsx";
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from "lucide-react";
import Image from "next/image";
import type React from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { forwardRef, useId, useState } from "react";

/** Small set of building blocks used by every ERP screen. */

/** The Annadata 360 logo (same image as the farmer app, copied in by design/build-tokens.mjs) and name. */
export function Logo({ size = "md", showName = true }: { size?: "md" | "lg"; showName?: boolean }) {
  const px = size === "lg" ? 72 : 36;
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image src="/brand/logo.jpg" alt="Annadata 360" width={px} height={px} priority className="rounded-full" />
      {showName && (
        <span className={clsx("font-display font-bold leading-none tracking-tight text-brand-800", size === "lg" ? "text-display" : "text-h2")}>
          Annadata <span className="text-accent">360</span>
        </span>
      )}
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
};

export function Button({ variant = "primary", loading, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-brand-600 text-white hover:bg-brand-700",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-canvas",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        variant === "ghost" && "text-muted hover:bg-canvas hover:text-ink",
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/**
 * Field label with the required / optional marker used on every ERP form:
 * required → red "*" after the label; optional → grey "(optional)".
 */
export function FieldLabel({
  htmlFor,
  id,
  children,
  required,
  optional,
}: {
  htmlFor?: string;
  id?: string;
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  const Tag = htmlFor ? "label" : "p";
  return (
    <Tag htmlFor={htmlFor} id={id} className="block text-sm font-medium text-ink">
      {children}
      {required && (
        <span className="ml-0.5 text-danger" aria-hidden>
          *
        </span>
      )}
      {required && <span className="sr-only"> (required)</span>}
      {optional && !required && <span className="ml-1 font-normal text-muted">(optional)</span>}
    </Tag>
  );
}

/** "Fields marked * are required", shown at the top of forms that have required fields. */
export function RequiredNote() {
  return (
    <p className="text-xs text-muted">
      Fields marked <span className="text-danger">*</span> are required.
    </p>
  );
}

/** A required field left empty after the person has been in it. */
function useRequiredCheck(required: boolean | undefined, value: unknown) {
  const [touched, setTouched] = useState(false);
  const empty = value === undefined || value === null || String(value).trim() === "";
  return { missing: !!required && touched && empty, onBlur: () => setTouched(true) };
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, optional, className, id, onBlur, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const check = useRequiredCheck(rest.required && !rest.readOnly, rest.value);
  error = error ?? (check.missing ? "This field is required" : undefined);
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={clsx("space-y-1.5", className)}>
      <FieldLabel htmlFor={inputId} required={rest.required} optional={optional}>
        {label}
      </FieldLabel>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(
          "block h-10 w-full rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-muted/70",
          error ? "border-danger" : "border-line focus:border-brand-600",
        )}
        onBlur={(e) => {
          check.onBlur();
          onBlur?.(e);
        }}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("rounded-lg border border-line bg-surface p-6 shadow-sm", className)}>{children}</div>;
}

const ALERT = {
  error: { icon: AlertCircle, cls: "border-danger/30 bg-danger-bg text-danger" },
  warning: { icon: TriangleAlert, cls: "border-warning/30 bg-warning-bg text-warning" },
  success: { icon: CheckCircle2, cls: "border-success/30 bg-success-bg text-success" },
  info: { icon: Info, cls: "border-line bg-canvas text-ink" },
};

export function Alert({ kind = "info", children }: { kind?: keyof typeof ALERT; children: ReactNode }) {
  const { icon: Icon, cls } = ALERT[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={clsx("flex gap-2 rounded-md border px-3 py-2.5 text-sm", cls)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}…
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  options: { value: string; label: string }[];
  placeholder?: string;
  optional?: boolean;
};

export function SelectField({ label, error, hint, options, placeholder, optional, className, id, onBlur, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const check = useRequiredCheck(rest.required && !rest.disabled, rest.value);
  error = error ?? (check.missing ? "Please choose one" : undefined);
  return (
    <div className={clsx("space-y-1.5", className)}>
      <FieldLabel htmlFor={selectId} required={rest.required} optional={optional}>
        {label}
      </FieldLabel>
      <select
        id={selectId}
        onBlur={(e) => {
          check.onBlur();
          onBlur?.(e);
        }}
        aria-invalid={error ? true : undefined}
        className={clsx(
          "block h-10 w-full rounded-md border bg-surface px-3 text-sm",
          error ? "border-danger" : "border-line focus:border-brand-600",
        )}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-sm text-danger">{error}</p> : hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger" | "brand"; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-canvas text-muted",
        tone === "success" && "bg-success-bg text-success",
        tone === "warning" && "bg-warning-bg text-warning",
        tone === "danger" && "bg-danger-bg text-danger",
        tone === "brand" && "bg-brand-50 text-brand-800",
      )}
    >
      {children}
    </span>
  );
}

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
};

export function TextAreaField({ label, error, hint, optional, className, id, onBlur, ...rest }: TextAreaProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  const check = useRequiredCheck(rest.required && !rest.readOnly, rest.value);
  error = error ?? (check.missing ? "This field is required" : undefined);
  return (
    <div className={clsx("space-y-1.5", className)}>
      <FieldLabel htmlFor={areaId} required={rest.required} optional={optional}>
        {label}
      </FieldLabel>
      <textarea
        id={areaId}
        onBlur={(e) => {
          check.onBlur();
          onBlur?.(e);
        }}
        rows={4}
        aria-invalid={error ? true : undefined}
        className={clsx(
          "block w-full rounded-md border bg-surface px-3 py-2 text-sm",
          error ? "border-danger" : "border-line focus:border-brand-600",
        )}
        {...rest}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
