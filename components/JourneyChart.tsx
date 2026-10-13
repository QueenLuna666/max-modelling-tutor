"use client";
// The student's journey: one dot per student message, placed on the phase the analyzer coded it in.
// Time runs right → left (RTL). Steps up = moving forward; orange dashed drops = going back to an earlier phase.

type Point = { index: number; messageId: number; phaseIndex: number; performance: string | null; back: boolean };

const PERF_CLASS: Record<string, string> = {
  high: "fill-ok",
  partial: "fill-info",
  low: "fill-warn",
};
const PERF_LABEL: Record<string, string> = { high: "ביצוע גבוה", partial: "ביצוע חלקי", low: "ביצוע נמוך" };

export function JourneyChart({
  phases,
  points,
  onSelect,
}: {
  phases: { id: string; label: string }[];
  points: Point[];
  onSelect?: (messageId: number) => void;
}) {
  const P = phases.length;
  const rowH = 34;
  const labelW = 118;
  const step = 32;
  const padT = 10;
  const padB = 30;
  const plotW = Math.max(points.length * step, 240);
  const width = labelW + plotW + 20;
  const height = padT + P * rowH + padB;

  const x = (i: number) => width - labelW - 12 - i * step - step / 2;
  const y = (pi: number) => padT + (P - 1 - pi) * rowH + rowH / 2;

  if (!points.length) {
    return <p className="text-sm text-muted">עוד אין הודעות מתויגות. המסע יופיע אחרי ההודעה הראשונה של התלמיד/ה.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="מסע התלמיד בין שלבי המידול"
          className="block"
        >
          {/* phase rows */}
          {phases.map((p, pi) => (
            <g key={p.id}>
              <line
                x1={0}
                x2={width - labelW}
                y1={y(pi)}
                y2={y(pi)}
                className="stroke-line"
                strokeDasharray="2 4"
              />
              <text
                x={width - 8}
                y={y(pi)}
                dominantBaseline="middle"
                textAnchor="start"
                direction="rtl"
                className="fill-muted text-[12px]"
              >
                {pi + 1}. {p.label}
              </text>
            </g>
          ))}

          {/* steps between consecutive points */}
          {points.map((pt, i) => {
            if (i === 0) return null;
            const prev = points[i - 1];
            return (
              <g key={`s${pt.index}`}>
                <line x1={x(i - 1)} x2={x(i)} y1={y(prev.phaseIndex)} y2={y(prev.phaseIndex)} className="stroke-accent" strokeWidth={2} />
                {prev.phaseIndex !== pt.phaseIndex && (
                  <line
                    x1={x(i)}
                    x2={x(i)}
                    y1={y(prev.phaseIndex)}
                    y2={y(pt.phaseIndex)}
                    className={pt.back ? "stroke-warn" : "stroke-accent"}
                    strokeWidth={2}
                    strokeDasharray={pt.back ? "4 3" : undefined}
                  />
                )}
              </g>
            );
          })}

          {/* points */}
          {points.map((pt, i) => (
            <g
              key={`p${pt.index}`}
              onClick={() => onSelect?.(pt.messageId)}
              className={onSelect ? "cursor-pointer" : undefined}
            >
              <title>
                {`הודעה ${pt.index} · ${phases[pt.phaseIndex]?.label ?? ""}${pt.performance ? " · " + PERF_LABEL[pt.performance] : ""}${pt.back ? " · חזרה לשלב קודם" : ""}`}
              </title>
              <circle cx={x(i)} cy={y(pt.phaseIndex)} r={11} fill="transparent" />
              <circle
                cx={x(i)}
                cy={y(pt.phaseIndex)}
                r={5.5}
                className={`${pt.performance ? PERF_CLASS[pt.performance] : "fill-muted"} stroke-surface`}
                strokeWidth={2}
              />
            </g>
          ))}

          {/* message numbers */}
          {points.map((pt, i) =>
            i === 0 || (i + 1) % 5 === 0 || i === points.length - 1 ? (
              <text key={`t${pt.index}`} x={x(i)} y={height - 10} textAnchor="middle" className="fill-muted text-[11px] tabular">
                {pt.index}
              </text>
            ) : null,
          )}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>מספר הודעה של התלמיד/ה ←</span>
        <Legend dot="bg-ok" text="ביצוע גבוה" />
        <Legend dot="bg-info" text="חלקי" />
        <Legend dot="bg-warn" text="נמוך" />
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0 border-s-2 border-dashed border-warn" />
          חזרה לשלב קודם
        </span>
        {onSelect && <span>· לחיצה על נקודה מקפיצה להודעה</span>}
      </div>
    </div>
  );
}

function Legend({ dot, text }: { dot: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block size-2.5 rounded-full ${dot}`} />
      {text}
    </span>
  );
}
