"use client";
// Budget: how much the agents were used, and the limits (adjustable without code). Researchers only.
import { useState } from "react";
import { isResearcherRole, StaffShell, useStaffData } from "@/components/StaffShell";
import { useStaffLang } from "@/lib/staffLang";

type Limits = {
  maxStudents: number;
  maxMessagesPerSession: number;
  maxSessionsPerTask: number;
  maxMessageChars: number;
  cooldownSeconds: number;
  dailyStudioBuilds: number;
  dailyResearchQueries: number;
};
type Kind = { calls: number; input: number; output: number; cacheRead: number; cacheWrite: number; today: number };
type Usage = { students: number; sessions: number; studentMessages: number; byKind: Record<string, Kind>; logReady: boolean; limits: Limits };

const LIMIT_LABELS: Record<keyof Limits, [string, string]> = {
  maxStudents: ["מספר תלמידים מרבי במערכת", "الحد الأقصى للطلاب في النظام"],
  maxMessagesPerSession: ["הודעות תלמיד/ה בשיחה אחת", "رسائل الطالب/ة في محادثة واحدة"],
  maxSessionsPerTask: ["שיחות לכל תלמיד/ה בכל משימה", "محادثات لكل طالب/ة في كل مهمة"],
  maxMessageChars: ["אורך הודעה (תווים)", "طول الرسالة (أحرف)"],
  cooldownSeconds: ["שניות לפחות בין הודעות", "ثوانٍ على الأقل بين الرسائل"],
  dailyStudioBuilds: ["בניות בסטודיו ביום", "بناء مهام في الاستوديو يوميًا"],
  dailyResearchQueries: ["שאלות לעוזר המחקר ולצ'אט על תלמיד/ה ביום", "أسئلة لمساعد البحث ودردشة الطالب يوميًا"],
};
const KIND_LABELS: Record<string, [string, string]> = {
  tutor: ["MAX (מדריך)", "MAX (المرشد)"],
  analyzer: ["הסוכן המאבחן", "الوكيل المحلّل"],
  studio: ["סוכן המשימות", "وكيل المهام"],
  summary: ["סיכומים", "ملخّصات"],
  research: ["עוזר המחקר", "مساعد البحث"],
  student_chat: ["צ'אט על תלמיד/ה", "دردشة عن طالب/ة"],
};
const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));

export default function UsagePage() {
  return <Shell />;
}

function Shell() {
  const { L } = useStaffLang();
  return (
    <StaffShell crumbs={[{ label: L("שימוש ותקציב", "الاستخدام والميزانية") }]}>
      {(me) => (isResearcherRole(me.role) ? <UsageView /> : <p className="text-muted">{L("לצוות המחקר בלבד.", "لطاقم البحث فقط.")}</p>)}
    </StaffShell>
  );
}

function UsageView() {
  const { L } = useStaffLang();
  const { data, error, reload } = useStaffData<Usage>("/api/staff/usage");
  const [edit, setEdit] = useState<Limits | null>(null);
  const [msg, setMsg] = useState("");
  if (error) return <p className="text-warn">{error}</p>;
  if (!data) return <p className="text-muted">{L("טוען…", "جارٍ التحميل…")}</p>;
  const limits = edit ?? data.limits;
  const pct = Math.min(100, Math.round((data.students / Math.max(1, data.limits.maxStudents)) * 100));
  const totals = Object.values(data.byKind).reduce(
    (t, k) => ({ input: t.input + k.input, output: t.output + k.output, cacheRead: t.cacheRead + k.cacheRead }),
    { input: 0, output: 0, cacheRead: 0 },
  );

  async function save() {
    setMsg("");
    const r = await fetch("/api/staff/usage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limits }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setMsg(j.error ?? L("השמירה נכשלה", "فشل الحفظ"));
    else {
      setMsg(L("המגבלות נשמרו", "تم حفظ الحدود"));
      setEdit(null);
      reload();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{L("שימוש ותקציב", "الاستخدام والميزانية")}</h1>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-semibold">{L("תלמידים בניסוי", "الطلاب في التجربة")}</h2>
          <span className="tabular text-2xl font-semibold">
            {data.students} / {data.limits.maxStudents}
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-paper">
          <div className={`h-full rounded-full ${pct >= 90 ? "bg-warn" : "bg-accent"}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted">
          {L("שיחות", "محادثات")}: {data.sessions} · {L("הודעות תלמידים", "رسائل الطلاب")}: {data.studentMessages}
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-semibold">{L("שימוש בסוכנים (טוקנים)", "استخدام الوكلاء (توكنات)")}</h2>
        {!data.logReady ? (
          <p className="text-sm text-warn">{L("המונה יתחיל לעבוד אחרי הרצת migration_006_limits.sql ב-Supabase.", "سيبدأ العدّاد بعد تشغيل migration_006_limits.sql في Supabase.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabular w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="px-2 py-2 text-start font-medium">{L("סוכן", "الوكيل")}</th>
                  <th className="px-2 py-2 text-center font-medium">{L("קריאות", "استدعاءات")}</th>
                  <th className="px-2 py-2 text-center font-medium">{L("היום", "اليوم")}</th>
                  <th className="px-2 py-2 text-center font-medium">{L("קלט", "مدخلات")}</th>
                  <th className="px-2 py-2 text-center font-medium">{L("מתוכו מהמטמון", "منها من الذاكرة المؤقتة")}</th>
                  <th className="px-2 py-2 text-center font-medium">{L("פלט", "مخرجات")}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.byKind).map(([k, v]) => (
                  <tr key={k} className="border-b border-line last:border-0">
                    <td className="px-2 py-1.5">{KIND_LABELS[k] ? L(...KIND_LABELS[k]) : k}</td>
                    <td className="px-2 py-1.5 text-center">{v.calls}</td>
                    <td className="px-2 py-1.5 text-center">{v.today}</td>
                    <td className="px-2 py-1.5 text-center">{fmt(v.input + v.cacheRead + v.cacheWrite)}</td>
                    <td className="px-2 py-1.5 text-center text-ok">{fmt(v.cacheRead)}</td>
                    <td className="px-2 py-1.5 text-center">{fmt(v.output)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="px-2 py-1.5">{L("סה״כ", "المجموع")}</td>
                  <td />
                  <td />
                  <td className="px-2 py-1.5 text-center">{fmt(totals.input + totals.cacheRead)}</td>
                  <td className="px-2 py-1.5 text-center text-ok">{fmt(totals.cacheRead)}</td>
                  <td className="px-2 py-1.5 text-center">{fmt(totals.output)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">
              {L("טוקנים מהמטמון (caching) זולים בהרבה מטוקנים רגילים.", "التوكنات من الذاكرة المؤقتة أرخص بكثير من التوكنات العادية.")}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-semibold">{L("מגבלות", "الحدود")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(LIMIT_LABELS) as (keyof Limits)[]).map((k) => (
            <label key={k} className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2 text-sm">
              <span>{L(...LIMIT_LABELS[k])}</span>
              <input
                type="number"
                min={0}
                value={limits[k]}
                onChange={(e) => setEdit({ ...limits, [k]: Number(e.target.value) })}
                className="tabular w-24 rounded-lg border border-line bg-surface px-2 py-1 text-center"
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={save} disabled={!edit} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {L("שמירת המגבלות", "حفظ الحدود")}
          </button>
          {msg && <span className="text-sm text-muted">{msg}</span>}
        </div>
      </section>
    </div>
  );
}
