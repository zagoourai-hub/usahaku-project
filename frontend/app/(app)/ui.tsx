import type { ReactNode } from "react";

export function PageHeader({ title, desc, action }: { title: string; desc: string; action?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
        <p className="text-muted-foreground">{desc}</p>
      </div>
      {action}
    </header>
  );
}

export const primaryBtn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70";
export const ghostBtn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60";
export const iconBtn = "flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

export function ErrorBox({ onRetry, message = "Gagal memuat data." }: { onRetry?: () => void; message?: string }) {
  return (
    <div role="alert" className="mt-4 rounded-xl border border-expense/30 bg-expense-soft p-4 text-sm text-expense">
      {message}{" "}
      {onRetry && (
        <button type="button" onClick={onRetry} className="rounded font-semibold underline">
          Coba lagi
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, desc, action }: { title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{desc}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Memuat" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      ))}
    </div>
  );
}
