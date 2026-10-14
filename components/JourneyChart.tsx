"use client";
import { useStaffLang } from "@/lib/staffLang";
// The student's journey between the modelling phases. A point appears only when something changes:
// the phase, or (for researchers) the performance level. Consecutive messages with the same phase
// and level are one point with a count. Time runs right → left (RTL). Steps up = forward;
// orange dashed drops = going back to an earlier phase.

type Point = { index: number; messageId: number; phaseIndex: number; performance: string | null; level?: string | null; back: boolean };
type Segment = { first: Point; last: Point; count: number; phaseIndex: number; level: string | null; back: boolean };

// Level colours (research team's levels; older codings fall back to the 3-point performance).
const LEVEL_OF_PERF: Record<string, string> = { high: "strong", partial: "intermediate", low: "significant_difficulty" };
const LEVEL_CLASS: Record<string, string> = {
  strong: "fill-ok",
  intermediate: "fill-info",
  significant_difficulty: "fill-warn",
  insufficient_evidence: "fill-muted",
};
const LEVEL_LABEL: Record<string, [string, string]> = {
  strong: ["חזק", "قوي"],
  intermediate: ["ביניים", "متوسط"],
  significant_difficulty: ["קושי משמעותי", "صعوبة كبيرة"],
  insufficient_evidence: ["אין די ראיות", "لا أدلة كافية"],
};

function segments(points: Point[], byLevel: boolean): Segment[] {
  const out: Segment[] = [];
  for (const p of points) {
    const level = byLevel ? (p.level ?? (p.performance ? LEVEL_OF_PERF[p.performance] : null) ?? null) : null;
    const cur = out[out.length - 1];
    if (cur && cur.phaseIndex === p.phaseIndex && cur.level === level) {
      cur.last = p;
      cur.count += 1;
    } else {
      out.push({ first: p, last: p, count: 1, phaseIndex: p.phaseIndex, level, back: !!cur && p.phaseIndex < cur.phaseIndex });
    }
  }
  return out;
}

export function JourneyChart({
  phases,
  points,
  onSelect,
  showPerformance = true,
}: {
  phases: { id: string; label: string }[];
  points: Point[];
  onSelect?: (messageId: number) => void;
  showPerformance?: boolean; // teachers see the path, not the lab's performance coding
}) {
  const { L, phase } = useStaffLang();
  const segs = segments(points, showPerformance);
  const P = phases.length;
  const rowH = 34;
  const labelW = 118;
  const step = 46;
  const padT = 14;
  const padB = 30;
  const plotW = Math.max(segs.length * step, 240);
  const width = labelW + plotW + 20;
  const height = padT + P * rowH + padB;

  const x = (i: number) => width - labelW - 12 - i * step - step / 2;
  const y = (pi: number) => padT + (P - 1 - pi) * rowH + rowH / 2;
  const range = (sg: Segment) => (sg.count > 1 ? `${sg.first.index}–${sg.last.index}` : `${sg.first.index}`);

  if (!segs.length) {
    return <p className="text-sm text-muted">{L("עוד אין הודעות מתויגות. המסע יופיע אחרי ההודעה הראשונה של התלמיד/ה.", "لا توجد رسائل مرمّزة بعد. سيظهر المسار بعد أول رسالة من الطالب/ة.")}</p>;
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={L("מסע התלמיד בין שלבי המידול", "مسار الطالب بين مراحل النمذجة")} className="block">
          {phases.map((p, pi) => (
            <g key={p.id}>
              <line x1={0} x2={width - labelW} y1={y(pi)} y2={y(pi)} className="stroke-line" strokeDasharray="2 4" />
              <text x={width - 8} y={y(pi)} dominantBaseline="middle" textAnchor="start" direction="rtl" className="fill-muted text-[12px]">
                {pi + 1}. {phase(p.id, p.label)}
              </text>
            </g>
          ))}

          {segs.map((sg, i) => {
            if (i === 0) return null;
            const prev = segs[i - 1];
            return (
              <g key={`s${i}`}>
                <line x1={x(i - 1)} x2={x(i)} y1={y(prev.phaseIndex)} y2={y(prev.phaseIndex)} className="stroke-accent" strokeWidth={2} />
                {prev.phaseIndex !== sg.phaseIndex && (
                  <line
                    x1={x(i)}
                    x2={x(i)}
                    y1={y(prev.phaseIndex)}
                    y2={y(sg.phaseIndex)}
                    className={sg.back ? "stroke-warn" : "stroke-accent"}
                    strokeWidth={2}
                    strokeDasharray={sg.back ? "4 3" : undefined}
                  />
                )}
              </g>
            );
          })}

          {segs.map((sg, i) => {
            const r = Math.min(5.5 + (sg.count - 1) * 1.2, 10);
            return (
              <g key={`p${i}`} onClick={() => onSelect?.(sg.first.messageId)} className={onSelect ? "cursor-pointer" : undefined}>
                <title>
                  {`${L("הודעות", "رسائل")} ${range(sg)} · ${phase(phases[sg.phaseIndex]?.id, phases[sg.phaseIndex]?.label ?? "")}${sg.level && LEVEL_LABEL[sg.level] ? " · " + L(...LEVEL_LABEL[sg.level]) : ""}${sg.back ? " · " + L("חזרה לשלב קודם", "عودة إلى مرحلة سابقة") : ""}`}
                </title>
                <circle cx={x(i)} cy={y(sg.phaseIndex)} r={13} fill="transparent" />
                <circle cx={x(i)} cy={y(sg.phaseIndex)} r={r} className={`${sg.level ? (LEVEL_CLASS[sg.level] ?? "fill-accent") : "fill-accent"} stroke-surface`} strokeWidth={2} />
                {sg.count > 1 && (
                  <text x={x(i)} y={y(sg.phaseIndex) - r - 3} textAnchor="middle" direction="ltr" className="fill-ink text-[10px] font-semibold tabular">
                    ×{sg.count}
                  </text>
                )}
              </g>
            );
          })}

          {segs.map((sg, i) => (
            <text key={`t${i}`} x={x(i)} y={height - 10} textAnchor="middle" direction="ltr" className="fill-muted text-[10px] tabular">
              {range(sg)}
            </text>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>{L("נקודה = שינוי בשלב או ברמה · ×n = כמה הודעות ברצף · המספרים למטה = הודעות התלמיד/ה ←", "نقطة = تغيّر في المرحلة أو المستوى · ×n = عدد الرسائل المتتالية · الأرقام = رسائل الطالب/ة ←")}</span>
        {showPerformance && (
          <>
            <Legend dot="bg-ok" text={L("חזק", "قوي")} />
            <Legend dot="bg-info" text={L("ביניים", "متوسط")} />
            <Legend dot="bg-warn" text={L("קושי משמעותי", "صعوبة كبيرة")} />
            <Legend dot="bg-muted" text={L("אין די ראיות", "لا أدلة كافية")} />
          </>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0 border-s-2 border-dashed border-warn" />
          {L("חזרה לשלב קודם", "عودة إلى مرحلة سابقة")}
        </span>
        {onSelect && <span>· {L("לחיצה על נקודה מקפיצה להודעה", "الضغط على نقطة ينقل إلى الرسالة")}</span>}
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
