"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isResearcherRole, StaffShell, useStaffData } from "@/components/StaffShell";
import { Modal } from "@/components/Modal";
import { ClassQr } from "@/components/ClassQr";
import { MiniMarkdown } from "@/components/MiniMarkdown";
import { FEATURES, type ClassSettings, type FeatureKey } from "@/lib/classSettings";
import { useStaffLang } from "@/lib/staffLang";

type Alert = { kind: string; text: string; textAr?: string; severity: "warn" | "info" };
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
  step: "bg-warn text-white ring-2 ring-warn/40",
};

const fmtTime = (iso: string, locale: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso: string, locale: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "numeric" });

export default function ClassPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useStaffData<Dashboard>(`/api/staff/classes/${id}`, 15000);
  const { L } = useStaffLang();
  const title = data?.class.name ?? data?.class.code ?? L("כיתה", "صف");
  return (
    <StaffShell crumbs={[{ label: title }]}>
      {(me) =>
        error ? <p className="text-warn">{error}</p> : !data ? <p className="text-muted">{L("טוען…", "جارٍ التحميل…")}</p> : <ClassView d={data} researcher={isResearcherRole(me.role)} reload={reload} />
      }
    </StaffShell>
  );
}

function ClassView({ d, researcher, reload }: { d: Dashboard; researcher: boolean; reload: () => void }) {
  const { L, lang, phase, locale } = useStaffLang();
  const alertText = (a: Alert) => (lang === "ar" ? (a.textAr ?? a.text) : a.text);
  const [showQr, setShowQr] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [summary, setSummary] = useState<{ loading: boolean; text: string; error: string } | null>(null);

  async function makeSummary() {
    setSummary({ loading: true, text: "", error: "" });
    const r = await fetch(`/api/staff/classes/${d.class.id}/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task?.id, lang }),
    });
    const j = await r.json().catch(() => ({}));
    setSummary({ loading: false, text: j.summary ?? "", error: r.ok ? "" : (j.error ?? L("שגיאה", "خطأ")) });
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
            {L("קוד כניסה לתלמידים", "رمز دخول الطلاب")}:{" "}
            <span dir="ltr" className="rounded bg-surface px-1.5 py-0.5 font-mono tracking-wider text-ink">
              {d.class.code}
            </span>{" "}
            · {L("מתעדכן כל 15 שניות", "يتحدّث كل 15 ثانية")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setShowQr(true)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-paper">
            📱 {L("קוד וברקוד לכיתה", "رمز وباركود للصف")}
          </button>
          <button type="button" onClick={() => setShowSettings(true)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-paper">
            ⚙️ {L("הגדרות כיתה", "إعدادات الصف")}
          </button>
          <button
            type="button"
            onClick={makeSummary}
            disabled={summary?.loading || !rows.length}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
          >
            ✨ {L("מה כדאי לעשות בשיעור הבא?", "ماذا نفعل في الدرس القادم؟")}
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
                {L("קובץ מחקר (Excel)", "ملف بحث (Excel)")}
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
            <h2 className="font-semibold">✨ {L("סיכום הכיתה מ-MAX", "ملخّص الصف من MAX")}</h2>
            <button type="button" onClick={() => setSummary(null)} className="text-xs text-muted underline">
              {L("סגירה", "إغلاق")}
            </button>
          </div>
          {summary.loading ? (
            <p className="animate-pulse text-sm text-muted">{L("MAX קורא את העבודה של כל התלמידים… (כחצי דקה)", "MAX يقرأ عمل جميع الطلاب… (نحو نصف دقيقة)")}</p>
          ) : summary.error ? (
            <p className="text-sm text-warn">{summary.error}</p>
          ) : (
            <MiniMarkdown text={summary.text} />
          )}
        </section>
      )}

      <Modal open={showQr} onClose={() => setShowQr(false)} title={L("כניסה לכיתה", "الدخول إلى الصف")} closeLabel={L("סגירה", "إغلاق")}>
        <ClassQr code={d.class.code} />
      </Modal>
      <Modal open={showSettings} onClose={() => setShowSettings(false)} title={L("הגדרות כיתה", "إعدادات الصف")} closeLabel={L("סגירה", "إغلاق")}>
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
        <Kpi label={L("תלמידים בכיתה", "طلاب الصف")} value={d.students.length} />
        <Kpi label={L("עובדים עכשיו", "يعملون الآن")} value={active} tone={active ? "accent" : undefined} />
        <Kpi label={L("סיימו", "أنهوا")} value={done} />
        <Kpi label={L("צריכים תשומת לב", "بحاجة إلى انتباه")} value={flagged.length} tone={flagged.length ? "warn" : undefined} />
      </dl>

      {flagged.length > 0 && (
        <section className="rounded-2xl border border-warn/30 bg-warn-soft/60 p-4">
          <h2 className="mb-2 font-semibold text-warn">{L("צריכים תשומת לב", "بحاجة إلى انتباه")}</h2>
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
                      {alertText(a)}
                    </span>
                  ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">{L("מפת הכיתה: תלמיד × שלב", "خريطة الصف: طالب × مرحلة")}</h2>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-muted">
            {L("עוד אין תלמידים שהתחילו את המשימה. תנו להם את הקוד", "لم يبدأ أي طالب المهمة بعد. أعطوهم الرمز")} <span dir="ltr" className="font-mono">{d.class.code}</span>.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="tabular w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="px-3 py-2 text-start font-medium">{L("תלמיד/ה", "الطالب/ة")}</th>
                  {task?.phases.map((p, i) => (
                    <th key={p.id} className="px-1 py-2 text-center font-medium">
                      <span className="block">{i + 1}</span>
                      <span className="block font-normal">{phase(p.id, p.label)}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium">{L("חזרות", "عودات")}</th>
                  <th className="px-3 py-2 text-center font-medium">{L("הודעות", "رسائل")}</th>
                  <th className="px-3 py-2 text-start font-medium">{L("פעילות אחרונה", "آخر نشاط")}</th>
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
                        {r.status === "done" ? L("סיים/ה", "أنهى/ت") : L("פעיל/ה", "نشط/ة")} · {fmtDate(r.startedAt, locale)}
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
                            title={`${phase(p.id, p.label)}: ${n} ${L("הודעות", "رسائل")}${visits > 1 ? `, ${L("נכנס/ה", "دخل/ت")} ${visits} ${L("פעמים", "مرات")}` : ""}${r.hints[p.id] ? `, ${L("הרמז החזק ביותר", "أقوى تلميح")}: ${r.hints[p.id]}` : ""}`}
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
                    <td className="px-3 py-2 text-muted">{fmtTime(r.lastActivity, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>{L("המספר = הודעות של התלמיד/ה בשלב", "الرقم = رسائل الطالب/ة في المرحلة")}</span>
          <LegendSwatch cls="bg-ok-soft" text={L("הסתדר/ה עם H0–H1", "تدبّر/ت مع H0–H1")} />
          <LegendSwatch cls="bg-warn-soft" text={L("קיבל/ה רמז ממוקד (H2)", "تلقّى/ت تلميحًا مركّزًا (H2)")} />
          <LegendSwatch cls="bg-warn" text={L("קיבל/ה מבנה חלקי או ליווי (H3–H4)", "تلقّى/ت بنية جزئية أو مرافقة (H3–H4)")} />
          <span>{L("↺ = חזר/ה לשלב · מסגרת = השלב הנוכחי", "↺ = عاد/ت إلى المرحلة · الإطار = المرحلة الحالية")}</span>
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
  const { L, lang } = useStaffLang();
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
    if (!r.ok) setMsg(j.error ?? L("השמירה נכשלה", "فشل الحفظ"));
    else onSaved();
  }

  return (
    <div className="space-y-6 text-sm">
      <section>
        <h3 className="mb-2 font-semibold">{L("משימות פתוחות בכיתה", "المهام المفتوحة في الصف")}</h3>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={allOpen} onChange={(e) => setSettings({ ...settings, tasks: e.target.checked ? null : published.map((t) => t.id) })} />
          {L("כל המשימות שפורסמו (כולל חדשות מהסטודיו)", "كل المهام المنشورة (بما فيها الجديدة من الاستوديو)")}
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
        <h3 className="mb-2 font-semibold">{L("כלי עזר לתלמידים", "أدوات مساعدة للطلاب")}</h3>
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
                  <span className="font-medium">{lang === "ar" ? FEATURES[k].ar : FEATURES[k].he}</span>
                  <span className="block text-xs text-muted">{lang === "ar" ? FEATURES[k].descAr : FEATURES[k].desc}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-semibold">{L("רמז הכי חזק ש-MAX רשאי לתת", "أقوى تلميح مسموح لـ MAX")}</h3>
        <select
          value={settings.maxHint}
          onChange={(e) => setSettings({ ...settings, maxHint: e.target.value as ClassSettings["maxHint"] })}
          className="rounded-lg border border-line bg-paper px-3 py-1.5"
        >
          <option value="step">{L("H4 ליווי צעד קטן (ברירת מחדל): דוגמה אחרת או בחירה מוגבלת, אף פעם לא הפתרון", "H4 مرافقة خطوة صغيرة (افتراضي): مثال آخر أو اختيار محدود، وليس الحل أبدًا")}</option>
          <option value="strong">{L("H3 מבנה חלקי: קשר מקומי או מסגרת להשלמה", "H3 بنية جزئية: علاقة موضعية أو إطار للإكمال")}</option>
          <option value="medium">{L("H2 רמז ממוקד: מצמצם את אזור החיפוש", "H2 تلميح مركّز: يضيّق مجال البحث")}</option>
          <option value="light">{L("H1 רמז קל בלבד: שאלות מכוונות", "H1 تلميح خفيف فقط: أسئلة موجِّهة")}</option>
        </select>
      </section>

      {msg && <p className="rounded-lg bg-warn-soft px-3 py-2 text-warn">{msg}</p>}
      <button type="button" onClick={save} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white hover:bg-accent-strong">
        {L("שמירה", "حفظ")}
      </button>
    </div>
  );
}
