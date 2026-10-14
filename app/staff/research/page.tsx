"use client";
// Research assistant: a research question → a Python analysis written by the agent → run live in the
// browser on the lab's data → charts, numbers and an interpretation. Researchers only.
import { useEffect, useState } from "react";
import { isResearcherRole, StaffShell, useStaffData } from "@/components/StaffShell";
import { MiniMarkdown } from "@/components/MiniMarkdown";
import { useStaffLang } from "@/lib/staffLang";
import { loadPython, runAnalysis, type RunResult } from "@/lib/pyodideRunner";

type Plan = { title: string; approach: string; python: string };
type ClassCard = { id: string; code: string; name: string | null };
type Stage = "idle" | "writing" | "python" | "packages" | "running" | "fixing" | "interpreting" | "done";

export default function ResearchPage() {
  return <Shell />;
}

function Shell() {
  const { L } = useStaffLang();
  return (
    <StaffShell crumbs={[{ label: L("עוזר מחקר", "مساعد البحث") }]}>
      {(me) => (isResearcherRole(me.role) ? <Research /> : <p className="text-muted">{L("לצוות המחקר בלבד.", "لطاقم البحث فقط.")}</p>)}
    </StaffShell>
  );
}

function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Research() {
  const { L, lang } = useStaffLang();
  const { data: classes } = useStaffData<{ classes: ClassCard[] }>("/api/staff/classes");
  const [question, setQuestion] = useState("");
  const [classId, setClassId] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [err, setErr] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [insight, setInsight] = useState("");

  // Start downloading Python in the background as soon as the page opens.
  useEffect(() => {
    loadPython().catch(() => {});
  }, []);

  const suggestions = [
    L("באיזה שלב מידול התלמידים נתקעים הכי הרבה?", "في أي مرحلة نمذجة يتعثّر الطلاب أكثر؟"),
    L("אילו קודי קושי הכי נפוצים בכל שלב?", "ما أكثر رموز الصعوبة شيوعًا في كل مرحلة؟"),
    L("האם תלמידים שחזרו לשלבים קודמים הגיעו רחוק יותר במידול?", "هل الطلاب الذين عادوا إلى مراحل سابقة وصلوا أبعد في النمذجة؟"),
    L("האם אחרי רמז H3–H4 התלמידים מתקדמים בהודעה הבאה?", "هل يتقدّم الطلاب في الرسالة التالية بعد تلميح H3–H4؟"),
    L("השוואה בין דוברי עברית לדוברי ערבית ברמות הביצוע", "مقارنة بين متحدّثي العبرية والعربية في مستويات الأداء"),
  ];

  async function run(q: string) {
    const text = q.trim();
    if (!text || (stage !== "idle" && stage !== "done")) return;
    setQuestion(text);
    setErr("");
    setPlan(null);
    setResult(null);
    setInsight("");
    try {
      setStage("writing");
      let r = await fetch("/api/staff/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text, classId, lang }) });
      let j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "error");
      let p: Plan = j.plan;
      setPlan(p);
      setFiles(j.files);
      setCounts(j.counts);

      const py = await loadPython((s) => setStage(s as Stage));
      setStage("running");
      let res = await runAnalysis(py, p.python, j.files);
      if (res.error) {
        // One automatic fix: send the error back to the assistant.
        setStage("fixing");
        r = await fetch("/api/staff/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text, classId, lang, previous: { python: p.python, error: res.error } }),
        });
        j = await r.json();
        if (r.ok) {
          p = j.plan;
          setPlan(p);
          setStage("running");
          res = await runAnalysis(py, p.python, j.files);
        }
      }
      setResult(res);
      if (res.error) {
        setStage("done");
        return;
      }
      setStage("interpreting");
      r = await fetch("/api/staff/research/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, lang, plan: p, stdout: res.stdout, charts: res.charts.length }),
      });
      j = await r.json();
      if (r.ok) setInsight(j.text);
      setStage("done");
    } catch (e) {
      setErr((e as Error).message);
      setStage("done");
    }
  }

  const busy = stage !== "idle" && stage !== "done";
  const STAGES: Record<string, string> = {
    writing: L("העוזר מתכנן את הניתוח וכותב קוד Python…", "المساعد يخطّط للتحليل ويكتب كود Python…"),
    python: L("טוען את Python בדפדפן (בפעם הראשונה לוקח כחצי דקה)…", "تحميل Python في المتصفح (أول مرة تستغرق نحو نصف دقيقة)…"),
    packages: L("טוען pandas ו-matplotlib…", "تحميل pandas و matplotlib…"),
    running: L("מריץ את הניתוח על הנתונים…", "تشغيل التحليل على البيانات…"),
    fixing: L("הקוד נתקל בשגיאה, העוזר מתקן…", "واجه الكود خطأ، المساعد يصلحه…"),
    interpreting: L("מפרש את התוצאות…", "تفسير النتائج…"),
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">🔬 {L("עוזר מחקר", "مساعد البحث")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          {L(
            "כתבו שאלת מחקר. העוזר כותב ניתוח ב-Python, מריץ אותו כאן בדפדפן על השיחות המקודדות (בלי התלמידים שהוסתרו), ומציג גרפים, מספרים ופרשנות. אפשר להוריד את הסקריפט ואת הנתונים.",
            "اكتبوا سؤال بحث. المساعد يكتب تحليلًا بلغة Python، يشغّله هنا في المتصفح على المحادثات المرمّزة (بدون الطلاب المخفيين)، ويعرض رسومًا بيانية وأرقامًا وتفسيرًا. يمكن تنزيل السكربت والبيانات.",
          )}
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{L("נתונים:", "البيانات:")}</span>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-lg border border-line bg-paper px-2 py-1.5">
            <option value="">{L("כל הכיתות", "كل الصفوف")}</option>
            {(classes?.classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.code}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          placeholder={L("למשל: האם תלמידים שניסחו הנחות מפורשות הגיעו לתיקוף בתדירות גבוהה יותר?", "مثلًا: هل الطلاب الذين صاغوا افتراضات صريحة وصلوا إلى التحقق أكثر؟")}
          className="w-full rounded-xl border border-line bg-paper px-3 py-2"
        />
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} type="button" disabled={busy} onClick={() => run(s)} className="rounded-full border border-line px-3 py-1 text-xs hover:border-accent hover:text-accent disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => run(question)} disabled={busy || !question.trim()} className="rounded-lg bg-accent px-5 py-2 font-semibold text-white disabled:opacity-40">
          {L("ניתוח", "تحليل")}
        </button>
        {busy && (
          <p role="status" className="animate-pulse text-sm text-muted">
            {STAGES[stage]}
          </p>
        )}
        {err && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{err}</p>}
      </section>

      {plan && (
        <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <div>
            <h2 className="text-lg font-semibold">{plan.title}</h2>
            <p className="mt-1 text-sm text-muted">{plan.approach}</p>
            {counts && (
              <p className="mt-1 text-xs text-muted">
                n = {counts.students} {L("תלמידים", "طلاب")} · {counts.sessions} {L("שיחות", "محادثات")} · {counts.messages} {L("הודעות תלמידים", "رسائل طلاب")}
              </p>
            )}
          </div>

          {result?.charts.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={`${L("גרף", "رسم بياني")} ${i + 1}`} className="mx-auto max-h-96 rounded-xl border border-line bg-white" />
          ))}

          {result?.stdout && (
            <details open className="rounded-xl bg-paper p-3">
              <summary className="cursor-pointer text-sm font-medium">{L("התוצאות המודפסות", "النتائج المطبوعة")}</summary>
              <pre dir="ltr" className="mt-2 max-h-80 overflow-auto text-xs leading-relaxed whitespace-pre-wrap">
                {result.stdout}
              </pre>
            </details>
          )}
          {result?.error && (
            <pre dir="ltr" className="max-h-60 overflow-auto rounded-xl bg-warn-soft p-3 text-xs whitespace-pre-wrap text-warn">
              {result.error}
            </pre>
          )}

          {insight && (
            <div className="rounded-xl border border-accent/30 bg-accent-soft/50 p-4">
              <MiniMarkdown text={insight} />
            </div>
          )}

          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer text-sm font-medium">{L("קוד ה-Python", "كود Python")}</summary>
            <pre dir="ltr" className="mt-2 max-h-96 overflow-auto rounded-lg bg-ink p-3 text-xs leading-relaxed text-white">
              {plan.python}
            </pre>
          </details>
          <div className="flex flex-wrap gap-2 text-sm">
            <button type="button" onClick={() => download("max_analysis.py", plan.python, "text/x-python")} className="rounded-lg border border-line px-3 py-1.5 hover:bg-paper">
              ⬇ {L("הורדת הסקריפט (.py)", "تنزيل السكربت (.py)")}
            </button>
            {files &&
              Object.entries(files).map(([name, content]) => (
                <button key={name} type="button" onClick={() => download(name, "﻿" + content, "text/csv")} className="rounded-lg border border-line px-3 py-1.5 hover:bg-paper">
                  ⬇ {name}
                </button>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
