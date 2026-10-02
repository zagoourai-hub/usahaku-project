"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { AlertCircle, Eye, EyeOff, Info } from "lucide-react";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: string;
  leading?: string;
  trailing?: ReactNode;
};

export function Field({ label, error, hint, leading, trailing, className = "", ...input }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        {leading && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-mono text-sm text-muted-foreground">{leading}</span>}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-12 w-full rounded-md border bg-card px-4 text-[15px] text-foreground shadow-sm placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-expense aria-invalid:focus-visible:ring-expense/30 dark:bg-card-inner ${leading ? "pl-11" : ""} ${trailing ? "pr-12" : ""} ${className}`}
          {...input}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm text-expense">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" /> {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({ label, error, children, ...select }: ComponentProps<"select"> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-12 w-full rounded-md border bg-card px-3 text-[15px] text-foreground shadow-sm focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-expense dark:bg-card-inner"
        {...select}
      >
        {children}
      </select>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm text-expense">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

export function PasswordField(props: Omit<FieldProps, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          aria-pressed={visible}
          className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      }
    />
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-expense/30 bg-expense-soft p-3 text-sm text-expense">
      <AlertCircle className="mt-0.5 size-4 shrink-0" /> {message}
    </p>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-base font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
    >
      {children}
    </button>
  );
}
