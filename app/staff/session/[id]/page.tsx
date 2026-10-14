"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StaffShell, useStaffData } from "@/components/StaffShell";
import { JourneyChart } from "@/components/JourneyChart";
import { MiniMarkdown } from "@/components/MiniMarkdown";
import { MessageText } from "@/components/MessageText";
import { useStaffLang } from "@/lib/staffLang";
import { HINT_AR, HINT_HE } from "@/lib/hints";

type Analysis = {
  performance: string | null;
  level?: string | null;
  studentPattern?: string | null;
  phases?: { phase: string; level: string; aspect: string; after_support: boolean }[];
  motivation: string | null;
  challenge: string | null;
  skills?: string[];
  evidence: string | null;
  asksForAnswer: boolean;
  phaseComplete: boolean;
};
type Message = {
  id: number;
  role: "student" | "tutor";
  content: string;
  createdAt: string;
  phase: string | null;
  wordCount?: number | null;
  responseMs?: number | null;
  hintLevel?: string | null;
  scaffoldType?: string | null;
  move?: string | null;
  analysis?: Analysis | null;
};
type Detail = {
  researcher: boolean;
  class: { id: string; code: string; name: string | null };
  student: { id: string; nickname: string };
  session: { id: string; taskTitle: string; lang: string; gender: string; status: string; currentPhase: string; startedAt: string; endedAt: string | null; summary?: string | null };
  phases: { id: string; label: string }[];
  challengeLabels: Record<string, string>;
  journey: {
    points: { index: number; messageId: number; phaseIndex: number; performance: string | null; back: boolean }[];
    visits: Record<string, number>;
    messages: Record<string, number>;
    backMoves: { from: string; to: string; index: number }[];
    furthestIndex: number;
  };
  metrics: {
    studentMessages: number;
    minutesTotal: number;
    avgWords: number;
    avgResponseSec: number | null;
    // research-only fields (absent for teachers)
    shortAnswers?: number;
    asksForAnswer?: number;
    difficultiesTotal?: number;
    difficultyDiversity?: number;
    skillDiversity?: number;
    backMoves: number;
    hints: { light: number; medium: number; strong: number; step?: number };
    perPhase: {
      phase: string;
      visits: number;
      studentMessages: number;
      minutes: number;
      difficulties?: number;
      difficultyCodes?: string[];
      skillCodes?: string[];
      completed: boolean;
    }[];
  };
  alerts: { kind: string; text: string; textAr?: string; severity: "warn" | "info" }[];
  messages: Message[];
  siblings: { id: string; taskTitle: string; status: string; startedAt: string }[];
};

type Pair = [string, string]; // [Hebrew, Arabic]
const PERF: Record<string, Pair> = { high: ["גבוה", "عالٍ"], partial: ["חלקי", "جزئي"], low: ["נמוך", "منخفض"] };
const LEVEL: Record<string, Pair> = {
  strong: ["חזק", "قوي"],
  intermediate: ["ביניים", "متوسط"],
  significant_difficulty: ["קושי משמעותי", "صعوبة كبيرة"],
  insufficient_evidence: ["אין די ראיות", "لا أدلة كافية"],
};
const MOT: Record<string, Pair> = { high: ["גבוהה", "عالية"], low: ["נמוכה", "منخفضة"] };
const HINT: Record<string, Pair> = Object.fromEntries(Object.keys(HINT_HE).map((k) => [k, [HINT_HE[k], HINT_AR[k]]]));
const SCAFFOLD: Record<string, Pair> = {
  in_step: ["תמיכה בתוך שלב", "دعم داخل المرحلة"],
  transition: ["מעבר בין שלבים", "انتقال بين المراحل"],
  motivation: ["הנעה", "تحفيز"],
};
const makeFmt = (locale: string) => (iso: string) =>
  new Date(iso).toLocaleString(locale, { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useStaffData<Detail>(`/api/staff/sessions/${id}`, 15000);
  const { L } = useStaffLang();
  return (
    <StaffShell
      crumbs={
        data
          ? [
              { href: `/staff/class/${data.class.id}`, label: data.class.name ?? data.class.code },
              { label: data.student.nickname },
            ]
          : []
      }
    >
      {() => (error ? <p className="text-warn">{error}</p> : !data ? <p className="text-muted">{L("טוען…", "جارٍ التحميل…")}</p> : <SessionView d={data} />)}
    </StaffShell>
  );
}

function SessionView({ d }: { d: Detail }) {
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [focus, setFocus] = useState<number | null>(null);
  const { L, lang, phase, locale } = useStaffLang();
  const fmt = makeFmt(locale);
  const P = (pair: Pair | undefined, raw: string | null | undefined) => (pair ? (lang === "ar" ? pair[1] : pair[0]) : (raw ?? "—"));
  const label = (pid: string | null) => phase(pid, d.phases.find((p) => p.id === pid)?.label ?? pid ?? "");
  const phaseNo = (pid: string | null) => d.phases.findIndex((p) => p.id === pid) + 1;

  function jump(messageId: number) {
    setFocus(messageId);
    document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{d.student.nickname}</h1>
          <p className="mt-1 text-sm text-muted">
            {d.session.taskTitle} · {d.session.status === "done" ? L("סיים/ה", "أنهى/ت") : L("פעיל/ה", "نشط/ة")} · {L("התחיל/ה", "بدأ/ت")}{" "}
            {fmt(d.session.startedAt)}
            {d.session.endedAt ? ` · ${L("סיים/ה", "أنهى/ت")} ${fmt(d.session.endedAt)}` : ""} · {d.session.gender === "female" ? L("בת", "بنت") : L("בן", "ولد")} ·{" "}
            {d.session.lang === "ar" ? L("ערבית", "العربية") : L("עברית", "العبرية")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/staff/transcript?sessionId=${d.session.id}`} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-paper">
            📄 {L("הורדת השיחה (Word)", "تنزيل المحادثة (Word)")}
          </a>
          {d.researcher && (
            <a href={`/api/staff/transcript?sessionId=${d.session.id}&analysis=1`} className="rounded-lg border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft">
              📄 {L("השיחה עם הניתוח (Word)", "المحادثة مع التحليل (Word)")}
            </a>
          )}
        </div>
        {d.researcher && (
          <div className="flex gap-2">
            <a href={`/api/staff/export?sessionId=${d.session.id}&format=xlsx`} className="rounded-lg border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft">
              {L("קובץ מחקר (Excel)", "ملف بحث (Excel)")}
            </a>
            <a href={`/api/staff/export?sessionId=${d.session.id}&format=json`} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-surface">
              JSON
            </a>
          </div>
        )}
      </div>

      <ProcessSummary sessionId={d.session.id} saved={d.session.summary ?? null} />
      <AskAboutStudent sessionId={d.session.id} name={d.student.nickname} researcher={d.researcher} />

      {d.alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {d.alerts.map((a) => (
            <span key={a.kind} className={`rounded-full px-3 py-1 text-sm ${a.severity === "warn" ? "bg-warn-soft text-warn" : "bg-info-soft text-info"}`}>
              {lang === "ar" ? (a.textAr ?? a.text) : a.text}
            </span>
          ))}
        </div>
      )}

      <dl className="tabular grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-8">
        {[
          [L("הודעות", "رسائل"), d.metrics.studentMessages],
          [L("דקות", "دقائق"), d.metrics.minutesTotal],
          [L("ממוצע מילים", "معدّل الكلمات"), d.metrics.avgWords],
          [L("תגובה ממוצעת (שנ׳)", "متوسط وقت الرد (ث)"), d.metrics.avgResponseSec ?? "—"],
          ...(d.researcher
            ? [
                [L("בקשות לתשובה", "طلبات للإجابة"), d.metrics.asksForAnswer],
                [L("תדירות קשיים", "تكرار الصعوبات"), d.metrics.difficultiesTotal],
                [L("מגוון קשיים", "تنوّع الصعوبات"), d.metrics.difficultyDiversity],
                [L("מגוון מיומנויות", "تنوّع المهارات"), d.metrics.skillDiversity],
              ]
            : [
                [L("חזרות לשלב קודם", "عودات لمرحلة سابقة"), d.metrics.backMoves],
                [L("רמזי H3–H4", "تلميحات H3–H4"), d.metrics.hints.strong + (d.metrics.hints.step ?? 0)],
              ]),
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-xl border border-line bg-surface px-3 py-2">
            <dd className="text-lg font-semibold">{v}</dd>
            <dt className="text-[11px] text-muted">{k}</dt>
          </div>
        ))}
      </dl>

      {/* journey */}
      <section className="space-y-3">
        <h2 className="font-semibold">{L("המסע בין שלבי המידול", "المسار بين مراحل النمذجة")}</h2>
        <JourneyChart phases={d.phases} points={d.journey.points} onSelect={jump} showPerformance={d.researcher} />
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface lg:col-span-2">
            <table className="tabular w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="px-3 py-2 text-start font-medium">{L("שלב", "مرحلة")}</th>
                  <th className="px-2 py-2 text-center font-medium">{L("כניסות", "دخول")}</th>
                  <th className="px-2 py-2 text-center font-medium">{L("הודעות", "رسائل")}</th>
                  <th className="px-2 py-2 text-center font-medium">{L("דקות", "دقائق")}</th>
                  {d.researcher && (
                    <>
                      <th className="px-2 py-2 text-center font-medium">{L("תדירות קשיים", "تكرار الصعوبات")}</th>
                      <th className="px-2 py-2 text-center font-medium">{L("מגוון קשיים", "تنوّع الصعوبات")}</th>
                      <th className="px-2 py-2 text-center font-medium">{L("מגוון מיומנויות", "تنوّع المهارات")}</th>
                      <th className="px-3 py-2 text-start font-medium">{L("קודים", "رموز")}</th>
                    </>
                  )}
                  <th className="px-2 py-2 text-center font-medium">{L("הושלם", "اكتملت")}</th>
                </tr>
              </thead>
              <tbody>
                {d.metrics.perPhase.map((p, i) => (
                  <tr key={p.phase} className="border-b border-line align-top last:border-0">
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {i + 1}. {label(p.phase)}
                    </td>
                    <td className={`px-2 py-1.5 text-center ${p.visits > 1 ? "font-semibold text-warn" : ""}`}>{p.visits}</td>
                    <td className="px-2 py-1.5 text-center">{p.studentMessages}</td>
                    <td className="px-2 py-1.5 text-center">{p.minutes}</td>
                    {d.researcher && (
                    <>
                    <td className={`px-2 py-1.5 text-center ${p.difficulties ? "text-warn" : ""}`}>{p.difficulties}</td>
                    <td className="px-2 py-1.5 text-center">{p.difficultyCodes?.length ?? 0}</td>
                    <td className="px-2 py-1.5 text-center">{p.skillCodes?.length ?? 0}</td>
                    <td className="px-3 py-1.5 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {(p.difficultyCodes ?? []).map((c) => (
                          <span key={c} title={d.challengeLabels[c]} className="rounded bg-warn-soft px-1.5 text-warn">
                            {c}
                          </span>
                        ))}
                        {(p.skillCodes ?? []).map((c) => (
                          <span key={c} title={d.challengeLabels[c]} className="rounded bg-ok-soft px-1.5 text-ok">
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    </>
                    )}
                    <td className="px-2 py-1.5 text-center">{p.completed ? "✓" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
            <h3 className="mb-2 font-medium">{L("חזרות לשלבים קודמים", "عودات إلى مراحل سابقة")}</h3>
            {d.journey.backMoves.length === 0 ? (
              <p className="text-muted">{L("אין חזרות. התלמיד/ה התקדם/ה ברצף.", "لا عودات. تقدّم/ت الطالب/ة بالتسلسل.")}</p>
            ) : (
              <ul className="space-y-1">
                {d.journey.backMoves.map((b, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => jump(d.journey.points[b.index - 1].messageId)} className="text-start hover:underline">
                      {L("הודעה", "رسالة")} {b.index}: {L("מ", "من ")}<b>{label(b.from)}</b> {L("חזר/ה ל", "عاد/ت إلى ")}<b>{label(b.to)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* transcript */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{L("השיחה המלאה", "المحادثة الكاملة")}</h2>
          {d.researcher && (
            <label className="flex items-center gap-2 text-sm">
              <input id="showAnalysis" type="checkbox" checked={showAnalysis} onChange={(e) => setShowAnalysis(e.target.checked)} />
              {L("להציג את הניתוח של כל הודעה", "عرض تحليل كل رسالة")}
            </label>
          )}
        </div>
        <ol className="space-y-2">
          {d.messages.map((m) => {
            const mine = m.role === "student";
            return (
              <li
                key={m.id}
                id={`msg-${m.id}`}
                className={`rounded-2xl border p-3 transition ${mine ? "border-line bg-surface" : "border-transparent bg-max"} ${focus === m.id ? "ring-2 ring-accent" : ""}`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`font-semibold ${mine ? "text-ink" : "text-accent"}`}>{mine ? d.student.nickname : "MAX"}</span>
                  <span className="text-muted">{fmt(m.createdAt)}</span>
                  {m.phase && (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent-strong">
                      {phaseNo(m.phase)}. {label(m.phase)}
                    </span>
                  )}
                </div>
                <div className="leading-relaxed">
                  <MessageText text={m.content} />
                </div>

                {d.researcher && showAnalysis && mine && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2 text-xs">
                    {m.analysis ? (
                      <>
                        {(m.analysis.phases ?? []).length > 1 &&
                          m.analysis.phases!.map((p) => (
                            <Tag
                              key={p.phase}
                              k={label(p.phase)}
                              v={`${P(LEVEL[p.level], p.level)}${p.aspect ? ` · ${p.aspect}` : ""}${p.after_support ? ` · ${L("אחרי תמיכה", "بعد الدعم")}` : ""}`}
                              warn={p.level === "significant_difficulty"}
                            />
                          ))}
                        {m.analysis.level ? (
                          <Tag k={L("רמה בשלב", "المستوى في المرحلة")} v={P(LEVEL[m.analysis.level], m.analysis.level)} warn={m.analysis.level === "significant_difficulty"} />
                        ) : (
                          <Tag k={L("ביצוע", "الأداء")} v={P(PERF[m.analysis.performance ?? ""], m.analysis.performance)} warn={m.analysis.performance === "low"} />
                        )}
                        {m.analysis.studentPattern && (
                          <Tag k={L("דפוס עד כה", "النمط حتى الآن")} v={P(LEVEL[m.analysis.studentPattern], m.analysis.studentPattern)} />
                        )}
                        <Tag k={L("מוטיבציה", "الدافعية")} v={P(MOT[m.analysis.motivation ?? ""], m.analysis.motivation)} warn={m.analysis.motivation === "low"} />
                        {m.analysis.challenge && (
                          <Tag k={L("קושי", "صعوبة")} v={`${m.analysis.challenge} · ${d.challengeLabels[m.analysis.challenge] ?? ""}`} warn />
                        )}
                        {m.analysis.skills?.map((c) => (
                          <span key={c} title={d.challengeLabels[c] ?? c} className="rounded-md bg-ok-soft px-1.5 py-0.5 text-ok">
                            {c} · {d.challengeLabels[c] ?? ""}
                          </span>
                        ))}
                        {m.analysis.asksForAnswer && <Tag k="" v={L("ביקש/ה תשובה", "طلب/ت الإجابة")} warn />}
                        {m.analysis.phaseComplete && <Tag k="" v={L("השלים/ה את השלב", "أكمل/ت المرحلة")} />}
                        <Tag k={L("מילים", "كلمات")} v={String(m.wordCount ?? "—")} />
                        {m.responseMs != null && <Tag k={L("זמן תגובה", "وقت الرد")} v={`${Math.round(m.responseMs / 1000)} ${L("שנ׳", "ث")}`} />}
                        {m.analysis.evidence && <span className="w-full text-muted">{L("עדות", "دليل")}: “{m.analysis.evidence}”</span>}
                      </>
                    ) : (
                      <span className="text-muted">{L("אין ניתוח להודעה הזו", "لا يوجد تحليل لهذه الرسالة")}</span>
                    )}
                  </div>
                )}
                {d.researcher && showAnalysis && !mine && (m.hintLevel || m.move) && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line/70 pt-2 text-xs">
                    {m.hintLevel && <Tag k="" v={P(HINT[m.hintLevel], m.hintLevel)} />}
                    {m.scaffoldType && <Tag k="" v={P(SCAFFOLD[m.scaffoldType], m.scaffoldType)} />}
                    {m.move && <Tag k={L("מהלך", "الخطوة")} v={m.move} />}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {d.siblings.length > 1 && (
        <section className="text-sm">
          <h2 className="mb-2 font-semibold">{L("משימות נוספות של", "مهام أخرى لـ")} {d.student.nickname}</h2>
          <ul className="flex flex-wrap gap-2">
            {d.siblings
              .filter((s) => s.id !== d.session.id)
              .map((s) => (
                <li key={s.id}>
                  <Link href={`/staff/session/${s.id}`} className="block rounded-lg border border-line bg-surface px-3 py-1.5 hover:border-accent">
                    {s.taskTitle} · {fmt(s.startedAt)} · {s.status === "done" ? L("סיים/ה", "أنهى/ت") : L("פעיל/ה", "نشط/ة")}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tag({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <span className={`rounded-md px-1.5 py-0.5 ${warn ? "bg-warn-soft text-warn" : "bg-paper text-muted"}`}>
      {k && <span className="opacity-75">{k}: </span>}
      {v}
    </span>
  );
}

function ProcessSummary({ sessionId, saved }: { sessionId: string; saved: string | null }) {
  const [text, setText] = useState(saved);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { L, lang } = useStaffLang();
  async function run() {
    setLoading(true);
    setError("");
    const r = await fetch(`/api/staff/sessions/${sessionId}/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang }),
    });
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) setError(j.error ?? L("שגיאה", "خطأ"));
    else setText(j.summary);
  }
  return (
    <section className="rounded-2xl border border-accent/30 bg-accent-soft/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">✨ {L("סיכום התהליך למורה", "ملخّص العملية للمعلّم/ة")}</h2>
        <button type="button" onClick={run} disabled={loading} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50">
          {loading ? L("כותב…", "يكتب…") : text ? L("עדכון הסיכום", "تحديث الملخّص") : L("כתבו לי סיכום", "اكتب لي ملخّصًا")}
        </button>
      </div>
      {loading && <p className="mt-2 animate-pulse text-sm text-muted">{L("MAX קורא את כל השיחה ואת הקידוד… (כחצי דקה)", "MAX يقرأ المحادثة كلها والترميز… (نحو نصف دقيقة)")}</p>}
      {error && <p className="mt-2 text-sm text-warn">{error}</p>}
      {text && !loading && (
        <div className="mt-3">
          <MiniMarkdown text={text} />
        </div>
      )}
      {!text && !loading && <p className="mt-1 text-sm text-muted">{L("סיכום קצר: איפה התלמיד/ה, חוזקות, היכן נתקע/ה ומה כדאי לעשות.", "ملخّص قصير: أين الطالب/ة، نقاط القوة، أين تعثّر/ت وماذا نفعل.")}</p>}
    </section>
  );
}

// Ask the assistant about this student's thinking (multi-turn, kept on this page only).
function AskAboutStudent({ sessionId, name, researcher }: { sessionId: string; name: string; researcher: boolean }) {
  const { L } = useStaffLang();
  const [turns, setTurns] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const suggestions = researcher
    ? [
        L("איך התלמיד/ה חשב/ה על ההנחות?", "كيف فكّر/ت الطالب/ة في الافتراضات؟"),
        L("איפה היה הקושי המרכזי ומה עזר לו/ה להתקדם?", "أين كانت الصعوبة الرئيسية وما الذي ساعد على التقدّم؟"),
        L("מה עשה/תה באופן עצמאי ומה רק אחרי רמזים של MAX?", "ما الذي فعله/ته باستقلالية وما الذي جاء بعد تلميحات MAX؟"),
        L("אילו שאלות כדאי לשאול אותו/ה בראיון המשך?", "ما الأسئلة التي يجدر طرحها في مقابلة متابعة؟"),
      ]
    : [
        L("איך התלמיד/ה חשב/ה על המשימה?", "كيف فكّر/ت الطالب/ة في المهمة؟"),
        L("במה כדאי לעזור לו/ה בשיעור הבא?", "بماذا يجدر مساعدته/ا في الدرس القادم؟"),
      ];

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true);
    setErr("");
    setQ("");
    const r = await fetch(`/api/staff/sessions/${sessionId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history: turns }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setErr(j.error ?? L("שגיאה", "خطأ"));
      setQ(question);
      return;
    }
    setTurns((t) => [...t, { role: "user", content: question }, { role: "assistant", content: j.answer }]);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-semibold">💬 {L(`שאלו על ${name}`, `اسألوا عن ${name}`)}</h2>
      <p className="mt-1 text-sm text-muted">
        {L("שאלה על אופן החשיבה של התלמיד/ה. התשובה מבוססת רק על השיחה, עם ציטוטים ומספרי הודעות.", "سؤال عن طريقة تفكير الطالب/ة. الإجابة مبنية على المحادثة فقط، مع اقتباسات وأرقام الرسائل.")}
      </p>
      <div className="mt-3 space-y-3">
        {turns.map((t, i) =>
          t.role === "user" ? (
            <p key={i} className="ms-auto w-fit max-w-[90%] rounded-2xl bg-accent px-3 py-2 text-sm text-white">
              {t.content}
            </p>
          ) : (
            <div key={i} className="rounded-2xl bg-paper px-4 py-3">
              <MiniMarkdown text={t.content} />
            </div>
          ),
        )}
        {busy && <p className="animate-pulse text-sm text-muted">{L("קורא את השיחה ועונה… (כחצי דקה)", "يقرأ المحادثة ويجيب… (نحو نصف دقيقة)")}</p>}
      </div>
      {turns.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} type="button" disabled={busy} onClick={() => ask(s)} className="rounded-full border border-line px-3 py-1 text-xs hover:border-accent hover:text-accent disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="mt-3 flex gap-2"
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} disabled={busy} placeholder={L("שאלה על התלמיד/ה…", "سؤال عن الطالب/ة…")} className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        <button type="submit" disabled={busy || !q.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          {L("שאלה", "اسأل")}
        </button>
      </form>
      {err && <p className="mt-2 text-sm text-warn">{err}</p>}
    </section>
  );
}
