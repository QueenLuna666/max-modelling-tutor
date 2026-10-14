"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isResearcherRole, StaffShell, useStaffData } from "@/components/StaffShell";
import { Modal } from "@/components/Modal";
import { ClassQr } from "@/components/ClassQr";
import { MiniMarkdown } from "@/components/MiniMarkdown";
import { FEATURES, type ClassSettings, type FeatureKey } from "@/lib/classSettings";

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
  settings: ClassSettings;
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
  const { data, error, reload } = useStaffData<Dashboard>(`/api/staff/classes/${id}`, 15000);
  const title = data?.class.name ?? data?.class.code ?? "כיתה";
  return (
    <StaffShell crumbs={[{ label: title }]}>
      {(me) =>
        error ? <p className="text-warn">{error}</p> : !data ? <p className="text-muted">טוען…</p> : <ClassView d={data} researcher={isResearcherRole(me.role)} reload={reload} />
      }
    </StaffShell>
  );
}

function ClassView({ d, researcher, reload }: { d: Dashboard; researcher: boolean; reload: () => void }) {
  const [showQr, setShowQr] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [summary, setSummary] = useState<{ loading: boolean; text: string; error: string } | null>(null);

  async function makeSummary() {
    setSummary({ loading: true, text: "", error: "" });
    const r = await fetch(`/api/staff/classes/${d.class.id}/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task?.id }),
    });
    const j = await r.json().catch(() => ({}));
    setSummary({ loading: false, text: j.summary ?? "", error: r.ok ? "" : (j.error ?? "שגיאה") });
  }

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
          <button type="button" onClick={() => setShowQr(true)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-paper">
            📱 קוד וברקוד לכיתה
          </button>
          <button type="button" onClick={() => setShowSettings(true)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-paper">
            ⚙️ הגדרות כיתה
          </button>
          <button
            type="button"
            onClick={makeSummary}
            disabled={summary?.loading || !rows.length}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
          >
            ✨ מה כדאי לעשות בשיעור הבא?
          </button>
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
              <a href={`/api/staff/export?classId=${d.class.id}&format=xlsx`} className="rounded-lg border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft">
                קובץ מחקר (Excel)
              </a>
              <a href={`/api/staff/export?classId=${d.class.id}&format=json`} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-surface">
                JSON
              </a>
            </>
          )}
        </div>
      </div>

      {summary && (
        <section className="rounded-2xl border border-accent/30 bg-accent-soft/50 p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-semibold">✨ סיכום הכיתה מ-MAX</h2>
            <button type="button" onClick={() => setSummary(null)} className="text-xs text-muted underline">
              סגירה
            </button>
          </div>
          {summary.loading ? (
            <p className="animate-pulse text-sm text-muted">MAX קורא את העבודה של כל התלמידים… (כחצי דקה)</p>
          ) : summary.error ? (
            <p className="text-sm text-warn">{summary.error}</p>
          ) : (
            <MiniMarkdown text={summary.text} />
          )}
        </section>
      )}

      <Modal open={showQr} onClose={() => setShowQr(false)} title="כניסה לכיתה" closeLabel="סגירה">
        <ClassQr code={d.class.code} />
      </Modal>
      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="הגדרות כיתה" closeLabel="סגירה">
        {showSettings && (
          <SettingsForm
            classId={d.class.id}
            initial={d.settings}
            onSaved={() => {
              setShowSettings(false);
              reload();
            }}
          />
        )}
      </Modal>

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

type StudioTask = { id: string; title: string; status: string };

function SettingsForm({ classId, initial, onSaved }: { classId: string; initial: ClassSettings; onSaved: () => void }) {
  const [settings, setSettings] = useState<ClassSettings>(initial);
  const [msg, setMsg] = useState("");
  const { data } = useStaffData<{ tasks: StudioTask[] }>("/api/studio");
  const published = (data?.tasks ?? []).filter((t) => t.status === "published");
  const allOpen = settings.tasks === null;

  async function save() {
    setMsg("");
    const r = await fetch(`/api/staff/classes/${classId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setMsg(j.error ?? "השמירה נכשלה");
    else onSaved();
  }

  return (
    <div className="space-y-6 text-sm">
      <section>
        <h3 className="mb-2 font-semibold">משימות פתוחות בכיתה</h3>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={allOpen} onChange={(e) => setSettings({ ...settings, tasks: e.target.checked ? null : published.map((t) => t.id) })} />
          כל המשימות שפורסמו (כולל חדשות מהסטודיו)
        </label>
        {!allOpen && (
          <ul className="mt-2 space-y-1 rounded-xl border border-line p-3">
            {published.map((t) => (
              <li key={t.id}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.tasks!.includes(t.id)}
                    onChange={(e) =>
                      setSettings({ ...settings, tasks: e.target.checked ? [...settings.tasks!, t.id] : settings.tasks!.filter((x) => x !== t.id) })
                    }
                  />
                  {t.title}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-semibold">כלי עזר לתלמידים</h3>
        <ul className="space-y-2">
          {(Object.keys(FEATURES) as FeatureKey[]).map((k) => (
            <li key={k}>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={settings.features[k]}
                  onChange={(e) => setSettings({ ...settings, features: { ...settings.features, [k]: e.target.checked } })}
                />
                <span>
                  <span className="font-medium">{FEATURES[k].he}</span>
                  <span className="block text-xs text-muted">{FEATURES[k].desc}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-semibold">רמז הכי חזק ש-MAX רשאי לתת</h3>
        <select
          value={settings.maxHint}
          onChange={(e) => setSettings({ ...settings, maxHint: e.target.value as ClassSettings["maxHint"] })}
          className="rounded-lg border border-line bg-paper px-3 py-1.5"
        >
          <option value="strong">חזק (ברירת מחדל): נותן מבנה, אף פעם לא את התשובה</option>
          <option value="medium">בינוני: מכוון לרעיון בלי לתת מבנה</option>
          <option value="light">קל בלבד: רק שאלות מכוונות</option>
        </select>
      </section>

      {msg && <p className="rounded-lg bg-warn-soft px-3 py-2 text-warn">{msg}</p>}
      <button type="button" onClick={save} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white hover:bg-accent-strong">
        שמירה
      </button>
    </div>
  );
}
