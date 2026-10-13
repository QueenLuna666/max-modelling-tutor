"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StaffShell, useStaffData } from "@/components/StaffShell";
import { JourneyChart } from "@/components/JourneyChart";

type Analysis = {
  performance: string | null;
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
  session: { id: string; taskTitle: string; lang: string; gender: string; status: string; currentPhase: string; startedAt: string; endedAt: string | null };
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
    shortAnswers: number;
    asksForAnswer: number;
    difficultiesTotal: number;
    difficultyDiversity: number;
    skillDiversity: number;
    backMoves: number;
    hints: { light: number; medium: number; strong: number };
    perPhase: {
      phase: string;
      visits: number;
      studentMessages: number;
      minutes: number;
      difficulties: number;
      difficultyCodes: string[];
      skillCodes: string[];
      completed: boolean;
    }[];
  };
  alerts: { kind: string; text: string; severity: "warn" | "info" }[];
  messages: Message[];
  siblings: { id: string; taskTitle: string; status: string; startedAt: string }[];
};

const PERF: Record<string, string> = { high: "גבוה", partial: "חלקי", low: "נמוך" };
const MOT: Record<string, string> = { high: "גבוהה", low: "נמוכה" };
const HINT: Record<string, string> = { none: "בלי רמז", light: "רמז קל", medium: "רמז בינוני", strong: "רמז חזק" };
const SCAFFOLD: Record<string, string> = { in_step: "תמיכה בתוך שלב", transition: "מעבר בין שלבים", motivation: "הנעה" };
const fmt = (iso: string) => new Date(iso).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useStaffData<Detail>(`/api/staff/sessions/${id}`, 15000);
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
      {() => (error ? <p className="text-warn">{error}</p> : !data ? <p className="text-muted">טוען…</p> : <SessionView d={data} />)}
    </StaffShell>
  );
}

function SessionView({ d }: { d: Detail }) {
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [focus, setFocus] = useState<number | null>(null);
  const label = (pid: string | null) => d.phases.find((p) => p.id === pid)?.label ?? pid ?? "";
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
            {d.session.taskTitle} · {d.session.status === "done" ? "סיים/ה" : "פעיל/ה"} · התחיל/ה {fmt(d.session.startedAt)}
            {d.session.endedAt ? ` · סיים/ה ${fmt(d.session.endedAt)}` : ""} · {d.session.gender === "female" ? "בת" : "בן"} ·{" "}
            {d.session.lang === "ar" ? "ערבית" : "עברית"}
          </p>
        </div>
        {d.researcher && (
          <div className="flex gap-2">
            <a href={`/api/staff/export?sessionId=${d.session.id}&format=xlsx`} className="rounded-lg border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft">
              קובץ מחקר (Excel)
            </a>
            <a href={`/api/staff/export?sessionId=${d.session.id}&format=json`} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-surface">
              JSON
            </a>
          </div>
        )}
      </div>

      {d.alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {d.alerts.map((a) => (
            <span key={a.kind} className={`rounded-full px-3 py-1 text-sm ${a.severity === "warn" ? "bg-warn-soft text-warn" : "bg-info-soft text-info"}`}>
              {a.text}
            </span>
          ))}
        </div>
      )}

      <dl className="tabular grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-8">
        {[
          ["הודעות", d.metrics.studentMessages],
          ["דקות", d.metrics.minutesTotal],
          ["ממוצע מילים", d.metrics.avgWords],
          ["תגובה ממוצעת (שנ׳)", d.metrics.avgResponseSec ?? "—"],
          ["בקשות לתשובה", d.metrics.asksForAnswer],
          ["תדירות קשיים", d.metrics.difficultiesTotal],
          ["מגוון קשיים", d.metrics.difficultyDiversity],
          ["מגוון מיומנויות", d.metrics.skillDiversity],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-xl border border-line bg-surface px-3 py-2">
            <dd className="text-lg font-semibold">{v}</dd>
            <dt className="text-[11px] text-muted">{k}</dt>
          </div>
        ))}
      </dl>

      {/* journey */}
      <section className="space-y-3">
        <h2 className="font-semibold">המסע בין שלבי המידול</h2>
        <JourneyChart phases={d.phases} points={d.journey.points} onSelect={jump} />
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface lg:col-span-2">
            <table className="tabular w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="px-3 py-2 text-start font-medium">שלב</th>
                  <th className="px-2 py-2 text-center font-medium">כניסות</th>
                  <th className="px-2 py-2 text-center font-medium">הודעות</th>
                  <th className="px-2 py-2 text-center font-medium">דקות</th>
                  <th className="px-2 py-2 text-center font-medium">תדירות קשיים</th>
                  <th className="px-2 py-2 text-center font-medium">מגוון קשיים</th>
                  <th className="px-2 py-2 text-center font-medium">מגוון מיומנויות</th>
                  <th className="px-3 py-2 text-start font-medium">קודים</th>
                  <th className="px-2 py-2 text-center font-medium">הושלם</th>
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
                    <td className={`px-2 py-1.5 text-center ${p.difficulties ? "text-warn" : ""}`}>{p.difficulties}</td>
                    <td className="px-2 py-1.5 text-center">{p.difficultyCodes.length}</td>
                    <td className="px-2 py-1.5 text-center">{p.skillCodes.length}</td>
                    <td className="px-3 py-1.5 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {p.difficultyCodes.map((c) => (
                          <span key={c} title={d.challengeLabels[c]} className="rounded bg-warn-soft px-1.5 text-warn">
                            {c}
                          </span>
                        ))}
                        {p.skillCodes.map((c) => (
                          <span key={c} title={d.challengeLabels[c]} className="rounded bg-ok-soft px-1.5 text-ok">
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-center">{p.completed ? "✓" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
            <h3 className="mb-2 font-medium">חזרות לשלבים קודמים</h3>
            {d.journey.backMoves.length === 0 ? (
              <p className="text-muted">אין חזרות. התלמיד/ה התקדם/ה ברצף.</p>
            ) : (
              <ul className="space-y-1">
                {d.journey.backMoves.map((b, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => jump(d.journey.points[b.index - 1].messageId)} className="text-start hover:underline">
                      הודעה {b.index}: מ<b>{label(b.from)}</b> חזר/ה ל<b>{label(b.to)}</b>
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
          <h2 className="font-semibold">השיחה המלאה</h2>
          {d.researcher && (
            <label className="flex items-center gap-2 text-sm">
              <input id="showAnalysis" type="checkbox" checked={showAnalysis} onChange={(e) => setShowAnalysis(e.target.checked)} />
              להציג את הניתוח של כל הודעה
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
                <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>

                {d.researcher && showAnalysis && mine && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2 text-xs">
                    {m.analysis ? (
                      <>
                        <Tag k="ביצוע" v={PERF[m.analysis.performance ?? ""] ?? "—"} warn={m.analysis.performance === "low"} />
                        <Tag k="מוטיבציה" v={MOT[m.analysis.motivation ?? ""] ?? "—"} warn={m.analysis.motivation === "low"} />
                        {m.analysis.challenge && (
                          <Tag k="קושי" v={`${m.analysis.challenge} · ${d.challengeLabels[m.analysis.challenge] ?? ""}`} warn />
                        )}
                        {m.analysis.skills?.map((c) => (
                          <span key={c} title={d.challengeLabels[c] ?? c} className="rounded-md bg-ok-soft px-1.5 py-0.5 text-ok">
                            {c} · {d.challengeLabels[c] ?? ""}
                          </span>
                        ))}
                        {m.analysis.asksForAnswer && <Tag k="" v="ביקש/ה תשובה" warn />}
                        {m.analysis.phaseComplete && <Tag k="" v="השלים/ה את השלב" />}
                        <Tag k="מילים" v={String(m.wordCount ?? "—")} />
                        {m.responseMs != null && <Tag k="זמן תגובה" v={`${Math.round(m.responseMs / 1000)} שנ׳`} />}
                        {m.analysis.evidence && <span className="w-full text-muted">עדות: “{m.analysis.evidence}”</span>}
                      </>
                    ) : (
                      <span className="text-muted">אין ניתוח להודעה הזו</span>
                    )}
                  </div>
                )}
                {d.researcher && showAnalysis && !mine && (m.hintLevel || m.move) && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line/70 pt-2 text-xs">
                    {m.hintLevel && <Tag k="" v={HINT[m.hintLevel] ?? m.hintLevel} />}
                    {m.scaffoldType && <Tag k="" v={SCAFFOLD[m.scaffoldType] ?? m.scaffoldType} />}
                    {m.move && <Tag k="מהלך" v={m.move} />}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {d.siblings.length > 1 && (
        <section className="text-sm">
          <h2 className="mb-2 font-semibold">משימות נוספות של {d.student.nickname}</h2>
          <ul className="flex flex-wrap gap-2">
            {d.siblings
              .filter((s) => s.id !== d.session.id)
              .map((s) => (
                <li key={s.id}>
                  <Link href={`/staff/session/${s.id}`} className="block rounded-lg border border-line bg-surface px-3 py-1.5 hover:border-accent">
                    {s.taskTitle} · {fmt(s.startedAt)} · {s.status === "done" ? "סיים/ה" : "פעיל/ה"}
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
