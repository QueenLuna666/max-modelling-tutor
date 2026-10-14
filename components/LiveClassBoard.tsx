"use client";
// Live class screen for the lesson itself: every student as a card in the column of the phase they
// are in now. Made to be projected or kept open on the teacher's laptop.
// Shows phases and activity only (no research coding), and names can be shortened or hidden.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BackButton } from "./BackButton";
import { LangSwitch, useStaffLang } from "@/lib/staffLang";

type Alert = { kind: string; text: string; textAr?: string; severity: "warn" | "info" };
type Row = {
  sessionId: string;
  studentId: string;
  nickname: string;
  excluded?: boolean;
  taskId: string;
  status: string;
  currentPhase: string;
  startedAt: string;
  lastActivity: string;
  studentMessages: number;
  perPhase: Record<string, number>;
  backMoves: number;
  hints: Record<string, string>;
  alerts: Alert[];
};
export type LiveDashboard = {
  class: { id: string; code: string; name: string | null };
  tasks: { id: string; title: string; phases: { id: string; label: string }[] }[];
  sessions: Row[];
};

const STUCK_MESSAGES = 6; // this many messages in the current phase = probably stuck
const ACTIVE_MINUTES = 10;
type NameMode = "full" | "short" | "none";

export function LiveClassBoard({ d }: { d: LiveDashboard }) {
  const { L, lang, phase, locale } = useStaffLang();
  // The task most students are working on is shown first.
  const byTask = useMemo(() => {
    const n = new Map<string, number>();
    for (const s of d.sessions) if (!s.excluded) n.set(s.taskId, (n.get(s.taskId) ?? 0) + 1);
    return n;
  }, [d.sessions]);
  const defaultTask = [...d.tasks].sort((a, b) => (byTask.get(b.id) ?? 0) - (byTask.get(a.id) ?? 0))[0];
  const [taskId, setTaskId] = useState<string>("");
  const task = d.tasks.find((t) => t.id === taskId) ?? defaultTask;
  const [names, setNames] = useState<NameMode>("short");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  // Data refreshes every few seconds; keep "now" in step with it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, [d]);

  // Latest conversation of each visible student on this task.
  const rows = useMemo(() => {
    const latest = new Map<string, Row>();
    for (const s of d.sessions) {
      if (s.excluded || !task || s.taskId !== task.id) continue;
      const cur = latest.get(s.studentId);
      if (!cur || s.startedAt > cur.startedAt) latest.set(s.studentId, s);
    }
    return [...latest.values()];
  }, [d.sessions, task]);

  const minutesAgo = (iso: string) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  const isStuck = (r: Row) =>
    r.status === "active" &&
    ((r.perPhase[r.currentPhase] ?? 0) >= STUCK_MESSAGES || r.alerts.some((a) => a.severity === "warn" && a.kind !== "motivation"));
  const shown = (r: Row, i: number) => {
    if (names === "full") return r.nickname;
    if (names === "none") return `${L("תלמיד/ה", "طالب/ة")} ${i + 1}`;
    const [first, ...rest] = r.nickname.trim().split(/\s+/);
    return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
  };
  const order = new Map(rows.map((r, i) => [r.studentId, i]));

  const phases = task?.phases ?? [];
  const active = rows.filter((r) => r.status === "active" && minutesAgo(r.lastActivity) < ACTIVE_MINUTES);
  const done = rows.filter((r) => r.status === "done");
  const stuck = rows.filter(isStuck);
  // "3 students stuck in building the model" — the phase with the most stuck students.
  const stuckByPhase = new Map<string, number>();
  for (const r of stuck) stuckByPhase.set(r.currentPhase, (stuckByPhase.get(r.currentPhase) ?? 0) + 1);
  const worst = [...stuckByPhase.entries()].sort((a, b) => b[1] - a[1])[0];

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  const columns = [...phases.map((p) => ({ id: p.id, label: phase(p.id, p.label), rows: rows.filter((r) => r.status !== "done" && r.currentPhase === p.id) })), { id: "__done", label: L("סיימו 🎉", "أنهوا 🎉"), rows: done }];
  const PH_BG = ["bg-ph1", "bg-ph2", "bg-ph3", "bg-ph4", "bg-ph5", "bg-ph6", "bg-ph7"];

  return (
    <div className="graph-paper flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <BackButton fallback={`/staff/class/${d.class.id}`} label={L("חזרה", "رجوع")} />
          <div>
            <h1 className="text-2xl font-bold">
              📺 {d.class.name ?? d.class.code} <span className="text-base font-normal text-muted">· {L("מסך כיתה חי", "شاشة الصف الحية")}</span>
            </h1>
            <p className="text-sm text-muted">
              {L("קוד כניסה:", "رمز الدخول:")}{" "}
              <b dir="ltr" className="font-display tracking-widest text-ink">
                {d.class.code}
              </b>{" "}
              · {L("מתעדכן כל 5 שניות", "يتحدّث كل 5 ثوانٍ")} · {new Date(now).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {d.tasks.length > 1 && (
            <select value={task?.id ?? ""} onChange={(e) => setTaskId(e.target.value)} className="rounded-lg border border-line bg-paper px-2 py-1.5">
              {d.tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}
          <div role="group" aria-label={L("שמות", "الأسماء")} className="flex rounded-lg border border-line p-0.5">
            {(
              [
                ["full", L("שם מלא", "اسم كامل")],
                ["short", L("שם פרטי", "اسم شخصي")],
                ["none", L("בלי שמות", "بدون أسماء")],
              ] as const
            ).map(([k, t]) => (
              <button key={k} type="button" onClick={() => setNames(k)} aria-pressed={names === k} className={`rounded-md px-2 py-1 text-xs ${names === k ? "bg-ink text-white" : "text-muted"}`}>
                {t}
              </button>
            ))}
          </div>
          <button type="button" onClick={fullscreen} className="rounded-lg border border-line px-3 py-1.5 hover:bg-paper">
            ⛶ {L("מסך מלא", "ملء الشاشة")}
          </button>
          <LangSwitch />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 px-5 pt-4 sm:grid-cols-4">
        {[
          [L("תלמידים", "طلاب"), rows.length, "bg-surface"],
          [L("עובדים עכשיו", "يعملون الآن"), active.length, "bg-ok-soft text-ok"],
          [L("צריכים עזרה", "يحتاجون مساعدة"), stuck.length, stuck.length ? "bg-warn-soft text-warn" : "bg-surface"],
          [L("סיימו", "أنهوا"), done.length, "bg-accent-soft text-accent-strong"],
        ].map(([k, v, cls]) => (
          <div key={String(k)} className={`rounded-2xl border border-line px-4 py-3 ${cls}`}>
            <div className="font-display text-4xl tabular-nums">{v}</div>
            <div className="text-sm">{k}</div>
          </div>
        ))}
      </section>

      {worst && (
        <p role="status" className="mx-5 mt-3 rounded-xl bg-warn-soft px-4 py-2 font-medium text-warn">
          ⚠{" "}
          {L(
            `${worst[1]} ${worst[1] === 1 ? "תלמיד/ה תקוע/ה" : "תלמידים תקועים"} בשלב "${phase(worst[0], phases.find((p) => p.id === worst[0])?.label ?? worst[0])}" — אולי שווה לעצור לדיון קצר.`,
            `${worst[1]} ${worst[1] === 1 ? "طالب/ة عالق/ة" : "طلاب عالقون"} في مرحلة "${phase(worst[0], phases.find((p) => p.id === worst[0])?.label ?? worst[0])}" — ربما يستحق التوقّف لنقاش قصير.`,
          )}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="m-5 rounded-2xl border border-line bg-surface p-8 text-center text-lg text-muted">
          {L("עוד אף תלמיד/ה לא התחיל/ה. התלמידים נכנסים עם הקוד", "لم يبدأ أي طالب بعد. يدخل الطلاب بالرمز")}{" "}
          <b dir="ltr" className="font-display tracking-widest text-ink">
            {d.class.code}
          </b>
        </p>
      ) : (
        <div className="grid flex-1 gap-3 overflow-x-auto p-5" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(150px, 1fr))` }}>
          {columns.map((c, ci) => (
            <section key={c.id} className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface/90">
              <h2 className="flex min-h-12 items-center gap-2 rounded-t-2xl border-b border-line px-3 py-2 text-sm font-semibold">
                {c.id !== "__done" && <span className={`h-3 w-3 shrink-0 rounded-full ${PH_BG[ci % PH_BG.length]}`} />}
                <span className="min-w-0 leading-tight">{c.id !== "__done" ? `${ci + 1}. ${c.label}` : c.label}</span>
                <span className="ms-auto rounded-full bg-paper px-2 text-xs tabular-nums">{c.rows.length}</span>
              </h2>
              <div className="flex flex-col gap-2 p-2">
                {c.rows.map((r) => {
                  const stuckNow = isStuck(r);
                  const idle = r.status === "active" && minutesAgo(r.lastActivity) >= ACTIVE_MINUTES;
                  const warn = r.alerts.find((a) => a.severity === "warn");
                  return (
                    <Link
                      key={r.sessionId}
                      href={`/staff/session/${r.sessionId}`}
                      className={`block rounded-xl border-2 px-3 py-2 transition hover:-translate-y-0.5 ${
                        r.status === "done" ? "border-accent/30 bg-accent-soft" : stuckNow ? "border-warn bg-warn-soft" : idle ? "border-line bg-paper opacity-60" : "border-ok/40 bg-ok-soft"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate font-semibold">{shown(r, order.get(r.studentId) ?? 0)}</span>
                        {stuckNow && <span aria-label={L("צריך/ה עזרה", "يحتاج/تحتاج مساعدة")}>✋</span>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted">
                        <span>
                          💬 {r.studentMessages}
                        </span>
                        {r.backMoves > 0 && <span>↩ {r.backMoves}</span>}
                        <span>
                          {minutesAgo(r.lastActivity) === 0 ? L("עכשיו", "الآن") : L(`לפני ${minutesAgo(r.lastActivity)} דק׳`, `قبل ${minutesAgo(r.lastActivity)} د`)}
                        </span>
                      </div>
                      {stuckNow && warn && <p className="mt-1 text-[11px] leading-tight text-warn">{lang === "ar" ? (warn.textAr ?? warn.text) : warn.text}</p>}
                      {stuckNow && !warn && (
                        <p className="mt-1 text-[11px] leading-tight text-warn">
                          {L(`${r.perPhase[r.currentPhase]} הודעות בשלב הזה`, `${r.perPhase[r.currentPhase]} رسائل في هذه المرحلة`)}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      <footer className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-4 text-xs text-muted">
        <span>🟩 {L("עובד/ת עכשיו", "يعمل/تعمل الآن")}</span>
        <span>🟧 ✋ {L(`צריך/ה עזרה: ${STUCK_MESSAGES}+ הודעות באותו שלב, שתיקה ארוכה או בקשות לתשובה`, `يحتاج/تحتاج مساعدة: ${STUCK_MESSAGES}+ رسائل في نفس المرحلة، صمت طويل أو طلبات للإجابة`)}</span>
        <span>⬜ {L(`לא פעיל/ה ${ACTIVE_MINUTES}+ דקות`, `غير نشط/ة ${ACTIVE_MINUTES}+ دقائق`)}</span>
        <span>{L("לחיצה על כרטיס פותחת את השיחה", "الضغط على بطاقة يفتح المحادثة")}</span>
      </footer>
    </div>
  );
}
