"use client";
// Replays one conversation message by message, with what happened behind the scenes:
// the analyzer's coding of each student message (researchers) and the hint level and move MAX chose.
// The phase ladder on the side lights up as the student moves between modelling phases.
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageText } from "./MessageText";
import { useStaffLang } from "@/lib/staffLang";
import { HINT_AR, HINT_CODE, HINT_HE } from "@/lib/hints";

export type ReplayMessage = {
  id: number;
  role: "student" | "tutor";
  content: string;
  phase: string | null;
  hintLevel?: string | null;
  move?: string | null;
  analysis?: {
    level?: string | null;
    performance?: string | null;
    studentPattern?: string | null;
    phases?: { phase: string; level: string }[];
    challenge: string | null;
    skills?: string[];
    evidence: string | null;
    asksForAnswer: boolean;
    phaseComplete: boolean;
  } | null;
};

type Pair = [string, string];
const LEVEL: Record<string, Pair> = {
  strong: ["חזק", "قوي"],
  intermediate: ["ביניים", "متوسط"],
  significant_difficulty: ["קושי משמעותי", "صعوبة كبيرة"],
  insufficient_evidence: ["אין די ראיות", "لا أدلة كافية"],
  high: ["גבוה", "عالٍ"],
  partial: ["חלקי", "جزئي"],
  low: ["נמוך", "منخفض"],
};
const LEVEL_TONE: Record<string, string> = {
  strong: "bg-ok-soft text-ok",
  high: "bg-ok-soft text-ok",
  intermediate: "bg-info-soft text-info",
  partial: "bg-info-soft text-info",
  significant_difficulty: "bg-warn-soft text-warn",
  low: "bg-warn-soft text-warn",
  insufficient_evidence: "bg-paper text-muted",
};
const MOVE: Record<string, Pair> = {
  opening: ["פתיחת המשימה", "افتتاح المهمة"],
  acknowledge_continue: ["חיזוק והזמנה להמשיך", "تعزيز ودعوة للاستمرار"],
  guiding_question: ["שאלה מכוונת", "سؤال موجِّه"],
  focused_hint: ["רמז ממוקד", "تلميح مركّز"],
  partial_structure: ["מבנה חלקי", "بنية جزئية"],
  small_step: ["ליווי בצעד קטן", "مرافقة بخطوة صغيرة"],
  give_info: ["מסירת מידע שחסר", "إعطاء معلومة ناقصة"],
  check_work: ["בדיקת העבודה", "فحص العمل"],
  refuse_full_solution: ["סירוב לתת פתרון מלא", "رفض إعطاء حل كامل"],
  acknowledge_frustration: ["הכרה בתסכול", "الاعتراف بالإحباط"],
  suggest_teacher: ["הצעה לפנות למורה", "اقتراح التوجّه للمعلّم"],
  clarify: ["בקשת הבהרה", "طلب توضيح"],
  offer_finish: ["הצעה לסיים או לאתגר", "عرض الإنهاء أو التحدّي"],
  extension: ["אתגר הרחבה", "تحدٍّ إضافي"],
  close: ["סגירת השיחה", "إغلاق المحادثة"],
};
const SPEEDS = [1, 2, 4];

export function ConversationReplay({
  messages,
  phases,
  researcher,
  studentName,
  phaseLabel,
  codeLabel,
  onClose,
}: {
  messages: ReplayMessage[];
  phases: { id: string; label: string }[];
  researcher: boolean;
  studentName: string;
  phaseLabel: (id: string | null) => string;
  codeLabel: (code: string) => string;
  onClose: () => void;
}) {
  const { L, lang } = useStaffLang();
  const P = (pair: Pair | undefined, raw?: string | null) => (pair ? (lang === "ar" ? pair[1] : pair[0]) : (raw ?? "—"));
  const [shown, setShown] = useState(1); // how many messages are visible
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(2);
  const listRef = useRef<HTMLDivElement>(null);
  const total = messages.length;

  // Advance on a timer while playing; longer messages stay a bit longer.
  useEffect(() => {
    if (!playing || shown >= total) return;
    const last = messages[shown - 1];
    const base = last.role === "student" ? 2200 : 1400 + Math.min(3500, last.content.length * 12);
    const t = setTimeout(() => setShown((n) => Math.min(total, n + 1)), base / speed);
    return () => clearTimeout(t);
  }, [playing, shown, speed, total, messages]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [shown]);

  // Keyboard: space = play/pause, arrows = step, Esc = close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowLeft") setShown((n) => Math.min(total, n + (document.dir === "rtl" ? 1 : -1)));
      else if (e.key === "ArrowRight") setShown((n) => Math.max(1, n + (document.dir === "rtl" ? -1 : 1)));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, total]);

  const visible = messages.slice(0, shown);
  // The state "so far": phases visited, current phase, moves back, the latest coding and MAX decision.
  const state = useMemo(() => {
    const visited = new Set<number>();
    let current = -1;
    let back = 0;
    let lastStudent: ReplayMessage | null = null;
    let lastTutor: ReplayMessage | null = null;
    for (const m of visible) {
      if (m.role === "student") {
        lastStudent = m;
        const i = phases.findIndex((p) => p.id === m.phase);
        if (i >= 0) {
          if (current >= 0 && i < current) back += 1;
          current = i;
          visited.add(i);
        }
      } else lastTutor = m;
    }
    const lastIsStudent = visible[visible.length - 1]?.role === "student";
    return { visited, current, back, lastStudent, lastTutor: lastIsStudent ? null : lastTutor };
  }, [visible, phases]);

  const a = state.lastStudent?.analysis;
  const level = a?.level ?? a?.performance ?? null;
  const studentNo = (idx: number) => messages.slice(0, idx + 1).filter((m) => m.role === "student").length;

  return (
    <div role="dialog" aria-modal="true" aria-label={L("הקרנה חוזרת של השיחה", "إعادة عرض المحادثة")} className="fixed inset-0 z-50 flex flex-col bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div>
          <h2 className="font-bold">▶️ {L("הקרנה חוזרת", "إعادة العرض")} · {studentName}</h2>
          <p className="text-xs text-muted">{L("רווח = עצירה/המשך · חצים = צעד · Esc = יציאה", "مسافة = إيقاف/متابعة · الأسهم = خطوة · Esc = خروج")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button type="button" onClick={() => setShown((n) => Math.max(1, n - 1))} className="rounded-lg border border-line px-2.5 py-1.5 hover:bg-paper" aria-label={L("הודעה קודמת", "الرسالة السابقة")}>
            ⏮
          </button>
          <button
            type="button"
            onClick={() => {
              if (shown >= total) setShown(1);
              setPlaying((p) => (shown >= total ? true : !p));
            }}
            className="min-w-24 rounded-lg bg-accent px-3 py-1.5 font-semibold text-white"
          >
            {shown >= total ? `↺ ${L("מההתחלה", "من البداية")}` : playing ? `⏸ ${L("עצירה", "إيقاف")}` : `▶ ${L("המשך", "متابعة")}`}
          </button>
          <button type="button" onClick={() => setShown((n) => Math.min(total, n + 1))} className="rounded-lg border border-line px-2.5 py-1.5 hover:bg-paper" aria-label={L("הודעה הבאה", "الرسالة التالية")}>
            ⏭
          </button>
          <div role="group" aria-label={L("מהירות", "السرعة")} className="flex rounded-lg border border-line p-0.5">
            {SPEEDS.map((s) => (
              <button key={s} type="button" onClick={() => setSpeed(s)} aria-pressed={speed === s} className={`rounded-md px-2 py-1 text-xs ${speed === s ? "bg-ink text-white" : "text-muted"}`}>
                ×{s}
              </button>
            ))}
          </div>
          <span dir="ltr" className="tabular-nums text-muted">
            {shown}/{total}
          </span>
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 hover:bg-paper">
            ✕ {L("סגירה", "إغلاق")}
          </button>
        </div>
        <input
          type="range"
          min={1}
          max={total}
          value={shown}
          onChange={(e) => {
            setPlaying(false);
            setShown(Number(e.target.value));
          }}
          aria-label={L("מיקום בשיחה", "الموضع في المحادثة")}
          className="w-full accent-[var(--color-accent)]"
        />
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-4 p-4 lg:grid-cols-[1fr_340px] lg:grid-rows-1">
        {/* The conversation as it unfolds */}
        <div ref={listRef} className="min-h-0 space-y-3 overflow-y-auto rounded-2xl border border-line bg-surface p-4">
          {visible.map((m, i) => {
            const isLast = i === visible.length - 1;
            return m.role === "student" ? (
              <div key={m.id} className={`replay-in flex flex-col items-start ${isLast ? "" : "opacity-80"}`}>
                <span className="mb-0.5 text-[11px] text-muted">
                  #{studentNo(i)} · {studentName} · {phaseLabel(m.phase)}
                </span>
                <div className={`max-w-[85%] rounded-2xl rounded-ss-sm bg-accent px-4 py-2.5 text-white ${isLast ? "replay-pulse" : ""}`}>
                  <MessageText text={m.content} />
                </div>
              </div>
            ) : (
              <div key={m.id} className={`replay-in flex flex-col items-end ${isLast ? "" : "opacity-80"}`}>
                <span className="mb-0.5 text-[11px] text-muted">
                  MAX{m.hintLevel ? ` · ${HINT_CODE[m.hintLevel] ?? m.hintLevel}` : ""}
                  {m.move && MOVE[m.move] ? ` · ${P(MOVE[m.move])}` : ""}
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-se-sm border border-line bg-max px-4 py-2.5">
                  <MessageText text={m.content} drawingLabel={L("ציור של MAX", "رسم من MAX")} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Behind the scenes */}
        <aside className="min-h-0 space-y-3 overflow-y-auto max-lg:max-h-[38vh]">
          <section className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold">{L("מסלול המידול", "مسار النمذجة")}</h3>
            <ol className="space-y-1">
              {phases.map((p, i) => {
                const cur = i === state.current;
                const seen = state.visited.has(i);
                return (
                  <li
                    key={p.id}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors ${cur ? "bg-accent font-semibold text-white" : seen ? "bg-accent-soft text-accent-strong" : "text-muted"}`}
                  >
                    <span className="tabular-nums">{i + 1}</span>
                    <span>{phaseLabel(p.id)}</span>
                    {seen && !cur && <span className="ms-auto">✓</span>}
                  </li>
                );
              })}
            </ol>
            {state.back > 0 && (
              <p className="mt-2 text-xs text-warn">
                ↩ {L("חזרות לשלב קודם:", "عودات لمرحلة سابقة:")} {state.back}
              </p>
            )}
          </section>

          {state.lastStudent && (
            <section key={`a-${state.lastStudent.id}`} className="replay-in rounded-2xl border border-line bg-surface p-4">
              <h3 className="mb-2 text-sm font-semibold">🔎 {L("סוכן הניתוח קרא את ההודעה", "وكيل التحليل قرأ الرسالة")}</h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">{L("שלב", "المرحلة")}</dt>
                  <dd className="font-medium">{phaseLabel(state.lastStudent.phase)}</dd>
                </div>
                {researcher && a && (
                  <>
                    {(a.phases?.length ?? 0) > 1 && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted">{L("שלבים נוספים", "مراحل إضافية")}</dt>
                        <dd className="text-end">{a.phases!.slice(1).map((x) => phaseLabel(x.phase)).join(", ")}</dd>
                      </div>
                    )}
                    {level && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted">{L("רמה", "المستوى")}</dt>
                        <dd className={`rounded-full px-2 text-xs leading-6 ${LEVEL_TONE[level] ?? ""}`}>{P(LEVEL[level], level)}</dd>
                      </div>
                    )}
                    {a.studentPattern && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted">{L("דפוס כללי", "النمط العام")}</dt>
                        <dd>{P(LEVEL[a.studentPattern], a.studentPattern)}</dd>
                      </div>
                    )}
                    {a.challenge && (
                      <div>
                        <dt className="text-muted">{L("קושי", "صعوبة")}</dt>
                        <dd className="text-xs">
                          <b dir="ltr">{a.challenge}</b> {codeLabel(a.challenge)}
                        </dd>
                      </div>
                    )}
                    {(a.skills?.length ?? 0) > 0 && (
                      <div>
                        <dt className="text-muted">{L("מיומנויות", "مهارات")}</dt>
                        <dd className="flex flex-wrap gap-1 pt-0.5">
                          {a.skills!.map((s) => (
                            <span key={s} dir="ltr" title={codeLabel(s)} className="rounded bg-ok-soft px-1.5 text-xs text-ok">
                              {s}
                            </span>
                          ))}
                        </dd>
                      </div>
                    )}
                    {a.asksForAnswer && <p className="text-xs text-warn">⚠ {L("ביקש/ה תשובה מוכנה", "طلب/ت إجابة جاهزة")}</p>}
                    {a.phaseComplete && <p className="text-xs text-ok">✓ {L("השלב הושלם", "اكتملت المرحلة")}</p>}
                    {a.evidence && <p className="border-s-2 border-line ps-2 text-xs text-muted">{a.evidence}</p>}
                  </>
                )}
              </dl>
            </section>
          )}

          {state.lastTutor && (
            <section key={`t-${state.lastTutor.id}`} className="replay-in rounded-2xl border border-accent/30 bg-accent-soft/60 p-4">
              <h3 className="mb-2 text-sm font-semibold">🧭 {L("MAX בחר איך לעזור", "MAX اختار كيف يساعد")}</h3>
              <dl className="space-y-1.5 text-sm">
                {state.lastTutor.hintLevel && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">{L("רמת רמז", "مستوى التلميح")}</dt>
                    <dd className="font-semibold">{lang === "ar" ? HINT_AR[state.lastTutor.hintLevel] : HINT_HE[state.lastTutor.hintLevel]}</dd>
                  </div>
                )}
                {state.lastTutor.move && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">{L("מהלך", "الخطوة")}</dt>
                    <dd>{P(MOVE[state.lastTutor.move], state.lastTutor.move)}</dd>
                  </div>
                )}
                {!state.lastTutor.hintLevel && !state.lastTutor.move && <p className="text-xs text-muted">{L("אין פרטים על ההחלטה הזו", "لا تفاصيل عن هذا القرار")}</p>}
              </dl>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
