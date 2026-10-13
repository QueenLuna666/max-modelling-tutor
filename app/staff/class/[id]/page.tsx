"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isResearcherRole, StaffShell, useStaffData } from "@/components/StaffShell";

type Alert = { kind: string; text: string; severity: "warn" | "info" };
type Row = {
  sessionId: string;
  studentId: string;
  nickname: string;
  taskId: string;
  status: string;
  currentPhase: string;
  startedAt: string;
  lastActivity: string;
  studentMessages: number;
  visits: Record<string, number>;
  perPhase: Record<string, number>;
  backMoves: number;
  furthestIndex: number;
  hints: Record<string, string>;
  alerts: Alert[];
};
type Dashboard = {
  class: { id: string; code: string; name: string | null };
  tasks: { id: string; title: string; phases: { id: string; label: string }[] }[];
  students: { id: string; nickname: string }[];
  sessions: Row[];
};

const HINT_CELL: Record<string, string> = {
  none: "bg-ok-soft text-ok",
  light: "bg-ok-soft text-ok",
  medium: "bg-warn-soft text-warn",
  strong: "bg-warn text-white",
};

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });

export default function ClassPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useStaffData<Dashboard>(`/api/staff/classes/${id}`, 15000);
  const title = data?.class.name ?? data?.class.code ?? "כיתה";
  return (
    <StaffShell crumbs={[{ label: title }]}>
      {(me) =>
        error ? <p className="text-warn">{error}</p> : !data ? <p className="text-muted">טוען…</p> : <ClassView d={data} researcher={isResearcherRole(me.role)} />
      }
    </StaffShell>
  );
}

function ClassView({ d, researcher }: { d: Dashboard; researcher: boolean }) {
  const [taskId, setTaskId] = useState(d.tasks[0]?.id ?? "");
  const task = d.tasks.find((t) => t.id === taskId) ?? d.tasks[0];
  const rows = useMemo(() => d.sessions.filter((s) => !task || s.taskId === task.id), [d.sessions, task]);
  const active = rows.filter((r) => r.status === "active").length;
  const done = rows.filter((r) => r.status === "done").length;
  const flagged = rows.filter((r) => r.alerts.some((a) => a.severity === "warn"));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{d.class.name ?? d.class.code}</h1>
          <p className="mt-1 text-sm text-muted">
            קוד כניסה לתלמידים:{" "}
            <span dir="ltr" className="rounded bg-surface px-1.5 py-0.5 font-mono tracking-wider text-ink">
              {d.class.code}
            </span>{" "}
            · מתעדכן כל 15 שניות
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {d.tasks.length > 1 && (
            <select id="taskSelect" value={taskId} onChange={(e) => setTaskId(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
              {d.tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}
          {researcher && (
            <>
              <a href={`/api/staff/export?classId=${d.class.id}&format=csv`} className="rounded-lg border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft">
                קובץ ניתוח (Excel/CSV)
              </a>
              <a href={`/api/staff/export?classId=${d.class.id}&format=json`} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-surface">
                JSON
              </a>
            </>
          )}
        </div>
      </div>

      <dl className="tabular grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="תלמידים בכיתה" value={d.students.length} />
        <Kpi label="עובדים עכשיו" value={active} tone={active ? "accent" : undefined} />
        <Kpi label="סיימו" value={done} />
        <Kpi label="צריכים תשומת לב" value={flagged.length} tone={flagged.length ? "warn" : undefined} />
      </dl>

      {flagged.length > 0 && (
        <section className="rounded-2xl border border-warn/30 bg-warn-soft/60 p-4">
          <h2 className="mb-2 font-semibold text-warn">צריכים תשומת לב</h2>
          <ul className="space-y-1.5 text-sm">
            {flagged.map((r) => (
              <li key={r.sessionId} className="flex flex-wrap items-center gap-2">
                <Link href={`/staff/session/${r.sessionId}`} className="font-medium underline">
                  {r.nickname}
                </Link>
                {r.alerts
                  .filter((a) => a.severity === "warn")
                  .map((a) => (
                    <span key={a.kind} className="rounded-full bg-surface px-2 py-0.5 text-xs text-warn">
                      {a.text}
                    </span>
                  ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">מפת הכיתה: תלמיד × שלב</h2>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-muted">
            עוד אין תלמידים שהתחילו את המשימה. תנו להם את הקוד <span dir="ltr" className="font-mono">{d.class.code}</span>.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="tabular w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="px-3 py-2 text-start font-medium">תלמיד/ה</th>
                  {task?.phases.map((p, i) => (
                    <th key={p.id} className="px-1 py-2 text-center font-medium">
                      <span className="block">{i + 1}</span>
                      <span className="block font-normal">{p.label}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium">חזרות</th>
                  <th className="px-3 py-2 text-center font-medium">הודעות</th>
                  <th className="px-3 py-2 text-start font-medium">פעילות אחרונה</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.sessionId} className="border-b border-line last:border-0 hover:bg-paper/60">
                    <td className="px-3 py-2">
                      <Link href={`/staff/session/${r.sessionId}`} className="font-medium text-accent hover:underline">
                        {r.nickname}
                      </Link>
                      <span className="ms-2 text-xs text-muted">
                        {r.status === "done" ? "סיים/ה" : "פעיל/ה"} · {fmtDate(r.startedAt)}
                      </span>
                    </td>
                    {task?.phases.map((p) => {
                      const n = r.perPhase[p.id] ?? 0;
                      const visits = r.visits[p.id] ?? 0;
                      const current = r.status === "active" && r.currentPhase === p.id;
                      const cls = n ? (HINT_CELL[r.hints[p.id] ?? "none"] ?? HINT_CELL.none) : "bg-paper text-muted/50";
                      return (
                        <td key={p.id} className="px-1 py-1.5 text-center">
                          <span
                            title={`${p.label}: ${n} הודעות${visits > 1 ? `, נכנס/ה ${visits} פעמים` : ""}${r.hints[p.id] ? `, הרמז החזק ביותר: ${r.hints[p.id]}` : ""}`}
                            className={`inline-flex h-8 min-w-11 items-center justify-center gap-0.5 rounded-md px-1.5 ${cls} ${current ? "ring-2 ring-accent ring-offset-1" : ""}`}
                          >
                            {n || "·"}
                            {visits > 1 && <span className="text-[10px] opacity-80">↺{visits}</span>}
                          </span>
                        </td>
                      );
                    })}
                    <td className={`px-3 py-2 text-center ${r.backMoves ? "font-semibold text-warn" : "text-muted"}`}>{r.backMoves}</td>
                    <td className="px-3 py-2 text-center">{r.studentMessages}</td>
                    <td className="px-3 py-2 text-muted">{fmtTime(r.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>המספר = הודעות של התלמיד/ה בשלב</span>
          <LegendSwatch cls="bg-ok-soft" text="הסתדר/ה עם רמז קל או בלי" />
          <LegendSwatch cls="bg-warn-soft" text="קיבל/ה רמז בינוני" />
          <LegendSwatch cls="bg-warn" text="קיבל/ה רמז חזק" />
          <span>↺ = חזר/ה לשלב · מסגרת = השלב הנוכחי</span>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "accent" | "warn" }) {
  const c = tone === "accent" ? "border-accent/30 bg-accent-soft text-accent-strong" : tone === "warn" ? "border-warn/30 bg-warn-soft text-warn" : "border-line bg-surface";
  return (
    <div className={`rounded-2xl border px-4 py-3 ${c}`}>
      <dd className="text-2xl font-semibold">{value}</dd>
      <dt className="text-xs opacity-80">{label}</dt>
    </div>
  );
}

function LegendSwatch({ cls, text }: { cls: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block size-3 rounded-sm ${cls}`} />
      {text}
    </span>
  );
}
