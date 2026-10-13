"use client";
// The student's progress bar through the modelling phases.
export function PhaseStepper({
  phases,
  current,
  label,
}: {
  phases: { id: string; label: string }[];
  current: string | null;
  label: string;
}) {
  const ci = Math.max(0, phases.findIndex((p) => p.id === current));
  return (
    <nav aria-label={label} className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1.5 py-1 sm:min-w-0 sm:flex-wrap sm:gap-y-2">
        {phases.map((p, i) => {
          const done = i < ci;
          const now = i === ci;
          return (
            <li key={p.id} className="flex items-center gap-1.5">
              <span
                aria-current={now ? "step" : undefined}
                className={[
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap",
                  now
                    ? "border-accent bg-accent text-white"
                    : done
                      ? "border-accent/30 bg-accent-soft text-accent-strong"
                      : "border-line bg-surface text-muted",
                ].join(" ")}
              >
                <span className="tabular font-semibold">{done ? "✓" : i + 1}</span>
                {p.label}
              </span>
              {i < phases.length - 1 && <span aria-hidden className="h-px w-3 bg-line" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
