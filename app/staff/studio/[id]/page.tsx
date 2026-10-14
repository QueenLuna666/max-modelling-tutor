"use client";
// One task in the studio: preview as students see it, talk with the task agent to change it,
// edit by hand, replace the picture, approve and publish.
import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { StaffShell, useStaffData } from "@/components/StaffShell";
import { TaskCard } from "@/components/TaskCard";
import { postStream, shrinkImage, type UploadImage } from "@/lib/clientMedia";
import { STATUS_LABEL, STATUS_STYLE, type TaskStatusUi } from "@/lib/studioUi";

type Lang = "he" | "ar" | "en";
type CardText = { title: string; definition: string; image_alt: string; points: string[]; question: string };
type Phase = {
  id: string;
  label: Record<Lang, string>;
  goal: string;
  evidence: string[];
  misconceptions: string[];
  hints: { light: string; medium: string; strong: string };
  compliment: string;
};
type TaskData = {
  id: string;
  title: Record<Lang, string>;
  statement: Record<Lang, string>;
  card?: { image?: string | null } & Partial<Record<Lang, CardText>>;
  givens: Record<string, number>;
  context_for_tutor?: string[];
  reference: Record<string, string>;
  opening: Record<Lang, { male: string; female: string }>;
  phases: Phase[];
};
type Turn = { role: "author" | "agent"; content: string; at: string };
type Row = { id: string; status: TaskStatusUi; data: TaskData; source: { chat?: Turn[]; description?: string } | null; builtIn: boolean };

const LANGS: { id: Lang; label: string }[] = [
  { id: "he", label: "עברית" },
  { id: "ar", label: "العربية" },
  { id: "en", label: "English" },
];

const QUICK = [
  "תעשה את המשימה קלה יותר לכיתה ז׳",
  "תעשה אותה מאתגרת יותר",
  "תשנה את המספר הנתון למשהו מציאותי יותר",
  "תוסיף שאלת המשך לתלמידים מהירים",
  "תבדוק שהניסוח בערבית טבעי וברור",
];

export default function StudioTaskPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <StaffShell crumbs={[{ href: "/staff/studio", label: "סטודיו משימות" }, { label: id }]}>
      {() => <Editor id={id} />}
    </StaffShell>
  );
}

function Editor({ id }: { id: string }) {
  const { data: row, error, reload } = useStaffData<Row>(`/api/studio/${id}`);
  const [lang, setLang] = useState<Lang>("he");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<TaskData | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  if (error) return <p className="text-warn">{error}</p>;
  if (!row) return <p className="text-muted">טוען…</p>;
  const task = editing ?? row.data;

  async function patch(body: { data?: TaskData; status?: TaskStatusUi }, okMsg: string) {
    setSaving(true);
    setMsg("");
    const r = await fetch(`/api/studio/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) {
      setMsg(d.error ?? "השמירה נכשלה");
      return false;
    }
    setMsg(okMsg);
    reload();
    return true;
  }

  async function replaceImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setSaving(true);
    try {
      const img = await shrinkImage(f);
      const r = await fetch(`/api/studio/${id}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: { data: img.data, mediaType: img.mediaType } }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "ההעלאה נכשלה");
      const base = editing ?? row!.data;
      const next = { ...base, card: { ...(base.card ?? {}), image: d.url } };
      if (editing) setEditing(next);
      else await patch({ data: next }, "התמונה הוחלפה");
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const card = task.card?.[lang];
  const status = row.status;

  return (
    <div className="space-y-5">
      {/* header and actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{row.data.title.he}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
            <span className={`rounded-md px-2 py-0.5 ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
            {row.builtIn && <span className="rounded-md bg-info-soft px-2 py-0.5 text-info">משימת המעבדה</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/student?task=${id}&code=DEMO1`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-paper"
          >
            נסו כתלמיד/ה ↗
          </a>
          {status === "draft" && (
            <button type="button" disabled={saving} onClick={() => patch({ status: "published" }, "המשימה פורסמה. התלמידים יראו אותה ברשימת המשימות.")} className="rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              ✓ אישור ופרסום לתלמידים
            </button>
          )}
          {status === "published" && (
            <button type="button" disabled={saving} onClick={() => patch({ status: "draft" }, "המשימה הוחזרה לטיוטה ולא מוצגת לתלמידים.")} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-paper disabled:opacity-50">
              הסתרה מהתלמידים
            </button>
          )}
          {status !== "archived" ? (
            <button type="button" disabled={saving} onClick={() => patch({ status: "archived" }, "המשימה הועברה לארכיון.")} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted hover:bg-paper disabled:opacity-50">
              לארכיון
            </button>
          ) : (
            <button type="button" disabled={saving} onClick={() => patch({ status: "draft" }, "המשימה שוחזרה כטיוטה.")} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-paper disabled:opacity-50">
              שחזור כטיוטה
            </button>
          )}
        </div>
      </div>
      {msg && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-strong">{msg}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {/* preview / edit */}
          <section className="rounded-2xl border border-line bg-surface p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div role="tablist" className="flex gap-1 rounded-lg bg-paper p-1 text-sm">
                {LANGS.map((l) => (
                  <button
                    key={l.id}
                    role="tab"
                    aria-selected={lang === l.id}
                    type="button"
                    onClick={() => setLang(l.id)}
                    className={`rounded-md px-3 py-1 ${lang === l.id ? "bg-surface font-semibold shadow-sm" : "text-muted"}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 text-sm">
                <input ref={imgRef} type="file" accept="image/*" onChange={replaceImage} className="hidden" />
                <button type="button" onClick={() => imgRef.current?.click()} disabled={saving} className="rounded-lg border border-line px-3 py-1.5 hover:bg-paper disabled:opacity-50">
                  🖼️ החלפת תמונה
                </button>
                {editing ? (
                  <>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={async () => {
                        if (await patch({ data: editing }, "השינויים נשמרו")) setEditing(null);
                      }}
                      className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-50"
                    >
                      שמירה
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-line px-3 py-1.5 hover:bg-paper">
                      ביטול
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setEditing(structuredClone(row.data))} className="rounded-lg border border-line px-3 py-1.5 hover:bg-paper">
                    ✏️ עריכה ידנית
                  </button>
                )}
              </div>
            </div>

            <div lang={lang} dir={lang === "en" ? "ltr" : "rtl"}>
              {editing ? (
                <CardEditor task={editing} lang={lang} onChange={setEditing} />
              ) : (
                <div className="mx-auto max-w-xl rounded-2xl border border-line bg-paper/50 p-4">
                  <TaskCard card={card ? { image: task.card?.image ?? null, ...card } : null} statement={task.statement[lang] ?? task.statement.he} />
                  <div className="mt-4 rounded-2xl bg-max px-4 py-2.5 text-sm">
                    <span className="mb-0.5 block text-[11px] font-semibold text-accent">MAX פותח כך (פנייה לבת)</span>
                    {task.opening[lang]?.female ?? task.opening.he.female}
                  </div>
                </div>
              )}
            </div>
          </section>

          <TutorView task={task} />

          <details className="rounded-2xl border border-line bg-surface p-5">
            <summary className="cursor-pointer font-semibold">עריכה מתקדמת (JSON)</summary>
            <JsonEditor key={JSON.stringify(row.data).length} value={row.data} onSave={(d) => patch({ data: d }, "נשמר")} saving={saving} />
          </details>
        </div>

        <AgentChat id={id} chat={row.source?.chat ?? []} onDone={reload} />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, rows = 1 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      {rows > 1 ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm leading-relaxed" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
      )}
    </label>
  );
}

function CardEditor({ task, lang, onChange }: { task: TaskData; lang: Lang; onChange: (t: TaskData) => void }) {
  const c: CardText = task.card?.[lang] ?? { title: "", definition: "", image_alt: "", points: [], question: "" };
  const setCard = (patch: Partial<CardText>) => onChange({ ...task, card: { ...(task.card ?? {}), [lang]: { ...c, ...patch } } });
  const op = task.opening[lang] ?? { male: "", female: "" };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">**מילה** = מודגש. כל נקודה בשורה נפרדת.</p>
      <Field label="שם המשימה (ברשימת המשימות)" value={task.title[lang] ?? ""} onChange={(v) => onChange({ ...task, title: { ...task.title, [lang]: v } })} />
      <Field label="כותרת הכרטיס" value={c.title} onChange={(v) => setCard({ title: v })} />
      <Field label="הגדרה" value={c.definition} onChange={(v) => setCard({ definition: v })} rows={3} />
      <Field label="הסברים (נקודה בכל שורה)" value={c.points.join("\n")} onChange={(v) => setCard({ points: v.split("\n").filter((x) => x.trim()) })} rows={4} />
      <Field label="השאלה" value={c.question} onChange={(v) => setCard({ question: v })} rows={3} />
      <Field label="תיאור התמונה (לקוראי מסך)" value={c.image_alt} onChange={(v) => setCard({ image_alt: v })} />
      <Field label="המשימה כטקסט רגיל" value={task.statement[lang] ?? ""} onChange={(v) => onChange({ ...task, statement: { ...task.statement, [lang]: v } })} rows={3} />
      <Field label="פתיחה של MAX (לבן)" value={op.male} onChange={(v) => onChange({ ...task, opening: { ...task.opening, [lang]: { ...op, male: v } } })} rows={2} />
      <Field label="פתיחה של MAX (לבת)" value={op.female} onChange={(v) => onChange({ ...task, opening: { ...task.opening, [lang]: { ...op, female: v } } })} rows={2} />
    </div>
  );
}

function TutorView({ task }: { task: TaskData }) {
  return (
    <details className="rounded-2xl border border-line bg-surface p-5" dir="ltr">
      <summary className="cursor-pointer font-semibold" dir="rtl">
        מה MAX יודע על המשימה (רק לצוות): רקע, פתרון ייחוס, ושישה שלבים עם רמזים
      </summary>
      <div className="mt-4 space-y-4 text-sm leading-relaxed">
        {!!task.context_for_tutor?.length && (
          <div>
            <h3 className="font-semibold">Background</h3>
            <ul className="mt-1 list-disc space-y-1 ps-5 text-muted">
              {task.context_for_tutor.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <h3 className="font-semibold">Givens</h3>
          <p className="font-mono text-xs text-muted">{JSON.stringify(task.givens)}</p>
        </div>
        <div>
          <h3 className="font-semibold">Reference solution</h3>
          <dl className="mt-1 space-y-1">
            {Object.entries(task.reference)
              .filter(([k]) => !k.startsWith("_"))
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="inline font-medium">{k}: </dt>
                  <dd className="inline text-muted">{String(v)}</dd>
                </div>
              ))}
          </dl>
        </div>
        {task.phases.map((p, i) => (
          <div key={p.id} className="rounded-xl bg-paper p-3">
            <h3 className="font-semibold">
              {i + 1}. {p.label.en} <span dir="rtl" className="font-normal text-muted">· {p.label.he}</span>
            </h3>
            <p className="mt-1">{p.goal}</p>
            <p className="mt-2 text-xs font-semibold text-ok">Evidence</p>
            <ul className="list-disc ps-5 text-muted">{p.evidence.map((e, j) => <li key={j}>{e}</li>)}</ul>
            <p className="mt-2 text-xs font-semibold text-warn">Expected difficulties</p>
            <ul className="list-disc ps-5 text-muted">{p.misconceptions.map((e, j) => <li key={j}>{e}</li>)}</ul>
            <p className="mt-2 text-xs font-semibold text-info">Hints</p>
            <ul className="ps-1 text-muted">
              <li>🟢 {p.hints.light}</li>
              <li>🟡 {p.hints.medium}</li>
              <li>🔴 {p.hints.strong}</li>
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

function JsonEditor({ value, onSave, saving }: { value: TaskData; onSave: (d: TaskData) => void; saving: boolean }) {
  const initial = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const [text, setText] = useState(initial);
  const [err, setErr] = useState("");
  return (
    <div className="mt-3">
      <textarea dir="ltr" value={text} onChange={(e) => setText(e.target.value)} rows={18} className="w-full rounded-lg border border-line bg-paper p-3 font-mono text-xs" />
      {err && <p className="text-sm text-warn">{err}</p>}
      <button
        type="button"
        disabled={saving}
        onClick={() => {
          try {
            onSave(JSON.parse(text));
            setErr("");
          } catch {
            setErr("ה-JSON לא תקין");
          }
        }}
        className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        שמירת JSON
      </button>
    </div>
  );
}

const EXPECTED_CHARS = 22000;

function AgentChat({ id, chat, onDone }: { id: string; chat: Turn[]; onDone: () => void }) {
  const [input, setInput] = useState("");
  const [image, setImage] = useState<UploadImage | null>(null);
  const [busy, setBusy] = useState<null | { stage: string; pct: number; asked: string }>(null);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function send(text: string) {
    const instruction = text.trim();
    if (!instruction || busy) return;
    setErr("");
    setInput("");
    setBusy({ stage: "הסוכן קורא את הבקשה…", pct: 5, asked: instruction });
    try {
      await postStream<{ stage?: string; progress?: number }>(
        `/api/studio/${id}/revise`,
        { instruction, image: image ? { data: image.data, mediaType: image.mediaType } : null },
        (ev) => {
          if (ev.progress) setBusy((b) => b && { ...b, stage: "כותב מחדש את המשימה…", pct: Math.min(96, 8 + (ev.progress! / EXPECTED_CHARS) * 88) });
        },
      );
      setImage(null);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
      setInput(instruction);
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside className="flex h-fit flex-col rounded-2xl border border-line bg-surface lg:sticky lg:top-4">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-semibold">שיחה עם סוכן המשימות</h2>
        <p className="text-xs text-muted">בקשו שינוי במילים שלכן. הסוכן כותב מחדש את המשימה כולה ושומר על העקביות שלה.</p>
      </div>
      <div className="max-h-[50vh] space-y-2 overflow-y-auto px-4 py-3 text-sm">
        {chat.length === 0 && <p className="text-muted">עוד אין שיחה על המשימה הזו.</p>}
        {chat.map((t, i) => (
          <div key={i} className={`flex ${t.role === "author" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[90%] rounded-2xl px-3 py-2 leading-relaxed whitespace-pre-wrap ${t.role === "author" ? "bg-accent text-white" : "bg-max"}`}>
              {t.content}
            </div>
          </div>
        ))}
        {busy && (
          <>
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-2xl bg-accent px-3 py-2 text-white">{busy.asked}</div>
            </div>
            <div role="status" className="rounded-xl bg-paper p-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-accent transition-all duration-700" style={{ width: `${busy.pct}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted">{busy.stage} (כדקה)</p>
            </div>
          </>
        )}
      </div>
      <div className="border-t border-line p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button key={q} type="button" disabled={!!busy} onClick={() => send(q)} className="rounded-full border border-line px-2.5 py-1 text-xs hover:border-accent hover:text-accent disabled:opacity-50">
              {q}
            </button>
          ))}
        </div>
        {image && (
          <div className="mb-2 flex items-center gap-2 text-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.preview} alt="" className="size-10 rounded object-cover" />
            <span className="text-muted">תמונה חדשה תצורף לבקשה</span>
            <button type="button" onClick={() => setImage(null)} className="text-warn underline">
              הסרה
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) setImage(await shrinkImage(f));
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} title="צירוף תמונה" className="rounded-lg border border-line px-2.5 py-2 hover:bg-paper">
            📷
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            disabled={!!busy}
            placeholder="למשל: תחליף את הנתון ל-500 ליטר ותוסיף רמז על יחידות"
            className="flex-1 resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm"
          />
          <button type="submit" disabled={!input.trim() || !!busy} className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
            שליחה
          </button>
        </form>
        {err && <p className="mt-2 text-sm text-warn">{err}</p>}
      </div>
    </aside>
  );
}
