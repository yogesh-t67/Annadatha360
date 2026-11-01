import clsx from "clsx";
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { forwardRef, useId } from "react";

/** Small set of building blocks used by every ERP screen. */

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className={clsx("font-semibold tracking-tight text-ink", size === "lg" ? "text-2xl" : "text-lg")}>
      Annadata <span className="text-brand-600">360</span>
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

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={clsx("space-y-1.5", className)}>
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(
          "block h-10 w-full rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-muted/70",
          error ? "border-danger" : "border-line focus:border-brand-600",
        )}
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
