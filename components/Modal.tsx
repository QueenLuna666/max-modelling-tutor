"use client";
// Accessible pop-up built on <dialog>: Esc and a click outside close it; the page behind stays as it is.
import { useEffect, useRef } from "react";

export function Modal({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(92vw,640px)] max-h-[85vh] rounded-2xl bg-surface p-0 text-ink shadow-2xl"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="min-w-0 text-lg font-semibold [overflow-wrap:anywhere]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 shrink-0 rounded-lg border border-line px-3 py-2 text-sm hover:bg-paper"
          >
            {closeLabel}
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </dialog>
  );
}
