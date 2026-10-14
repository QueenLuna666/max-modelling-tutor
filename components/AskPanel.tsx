"use client";
// A small multi-turn chat with the assistant about a student or a whole class (kept on the page only).
import { useState } from "react";
import { MiniMarkdown } from "./MiniMarkdown";
import { useStaffLang } from "@/lib/staffLang";

export function AskPanel({
  endpoint,
  title,
  intro,
  suggestions,
  placeholder,
  busyText,
}: {
  endpoint: string;
  title: string;
  intro: string;
  suggestions: string[];
  placeholder: string;
  busyText: string;
}) {
  const { L } = useStaffLang();
  const [turns, setTurns] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true);
    setErr("");
    setQ("");
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history: turns }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r || !r.ok) {
      setErr(j.error ?? L("שגיאה", "خطأ"));
      setQ(question);
      return;
    }
    setTurns((t) => [...t, { role: "user", content: question }, { role: "assistant", content: j.answer }]);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">💬 {title}</h2>
        {turns.length > 0 && (
          <button type="button" onClick={() => setTurns([])} className="rounded-lg border border-line px-2.5 py-1 text-xs hover:bg-paper">
            {L("שיחה חדשה", "محادثة جديدة")}
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">{intro}</p>
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
        {busy && <p className="animate-pulse text-sm text-muted">{busyText}</p>}
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
        <input value={q} onChange={(e) => setQ(e.target.value)} disabled={busy} placeholder={placeholder} className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        <button type="submit" disabled={busy || !q.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          {L("שאלה", "اسأل")}
        </button>
      </form>
      {err && <p className="mt-2 text-sm text-warn">{err}</p>}
    </section>
  );
}
