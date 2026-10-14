"use client";
// "Back" on every page: goes to the previous page, or to `fallback` when the page was opened directly.
import { useRouter } from "next/navigation";

export function BackButton({ fallback, label = "חזרה", className = "" }: { fallback: string; label?: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:border-accent hover:text-accent ${className}`}
    >
      {/* In right-to-left pages "back" points right. */}
      <span aria-hidden className="text-base leading-none">→</span>
      {label}
    </button>
  );
}
