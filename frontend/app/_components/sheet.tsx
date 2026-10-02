"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

// Native <dialog>: showModal() gives focus trap, Esc to close, inert background
// and top-layer rendering for free.
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()} // backdrop click
      aria-labelledby="sheet-title"
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border bg-card p-0 text-foreground shadow-md backdrop:bg-black/40 backdrop:backdrop-blur-[2px] sm:m-auto sm:max-w-lg sm:rounded-2xl"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
        <h2 id="sheet-title" className="text-lg font-bold">
          {title}
        </h2>
        <button type="button" onClick={onClose} aria-label="Tutup" className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-5" />
        </button>
      </div>
      <div className="p-5">{open && children}</div>
    </dialog>
  );
}
