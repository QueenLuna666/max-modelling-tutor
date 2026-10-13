"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { readStudent, tr, useStudent, type StudentLogin } from "@/lib/i18n";
import { sendMessage, startSession, type StartResult } from "@/lib/chatClient";
import { Modal } from "@/components/Modal";

type Msg = { role: "student" | "tutor"; content: string };
type TaskInfo = StartResult["task"];

const sessionKey = (taskId: string) => `max_session_${taskId}`;

export default function TaskWork() {
  const router = useRouter();
  const { taskId } = useParams<{ taskId: string }>();
  const me = useStudent();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [task, setTask] = useState<TaskInfo | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [status, setStatus] = useState<"active" | "done">("active");
  const [draft, setDraft] = useState<string | null>(null); // MAX's reply while streaming
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showTask, setShowTask] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const lastReplyAt = useRef<number>(0); // set when MAX's reply arrives
  const bottom = useRef<HTMLDivElement>(null);

  // Start a new session, or resume the one saved for this task (page refresh).
  useEffect(() => {
    const s = readStudent();
    if (!s) {
      router.replace("/student");
      return;
    }
    let cancelled = false;

    async function boot(login: StudentLogin) {
      let saved: string | null = null;
      try {
        saved = sessionStorage.getItem(sessionKey(taskId));
      } catch {}
      if (saved) {
        const r = await fetch(`/api/session/${saved}`);
        if (r.ok) {
          const d = await r.json();
          if (!cancelled && d.status === "active") {
            setSessionId(d.sessionId);
            setTask(d.task);
            setMessages(d.messages);
            lastReplyAt.current = Date.now();
            return;
          }
        }
      }
      try {
        const d = await startSession({ ...login, taskId });
        if (cancelled) return;
        try {
          sessionStorage.setItem(sessionKey(taskId), d.sessionId);
        } catch {}
        setSessionId(d.sessionId);
        setTask(d.task);
        setMessages([{ role: "tutor", content: d.opening }]);
        lastReplyAt.current = Date.now();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : tr("error", login.lang));
      }
    }
    boot(s);
    return () => {
      cancelled = true;
    };
  }, [router, taskId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, draft]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || !sessionId || sending || status !== "active" || !me) return;
    setSending(true);
    setError("");
    setInput("");
    setMessages((m) => [...m, { role: "student", content: text }]);
    setDraft("");
    try {
      const since = lastReplyAt.current ? Date.now() - lastReplyAt.current : null;
      const { reply } = await sendMessage(sessionId, text, since, (soFar) =>
        setDraft(soFar),
      );
      setMessages((m) => [...m, { role: "tutor", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("error", me.lang));
    } finally {
      setDraft(null);
      setSending(false);
      lastReplyAt.current = Date.now();
    }
  }, [input, sessionId, sending, status, me]);

  async function finish() {
    if (!sessionId) return;
    await fetch(`/api/session/${sessionId}/finish`, { method: "POST" });
    try {
      sessionStorage.removeItem(sessionKey(taskId));
    } catch {}
    setStatus("done");
    setConfirmFinish(false);
  }

  if (!me) return null;
  const { lang, gender } = me;

  if (error && !task) {
    return (
      <main lang={lang} className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-warn">{error}</p>
        <Link href="/student" className="mt-4 inline-block text-accent underline">
          {tr("studentLogin", lang)}
        </Link>
      </main>
    );
  }

  return (
    <main lang={lang} className="mx-auto flex h-dvh max-w-3xl flex-col px-4">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
        <div className="min-w-0">
          <Link href="/student/tasks" className="text-xs text-muted hover:underline">
            ← {tr("backToTasks", lang)}
          </Link>
          <h1 className="truncate text-lg font-semibold">{task?.title ?? tr("loading", lang)}</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowTask(true)}
            disabled={!task}
            className="rounded-lg border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
          >
            {tr("showTask", lang)}
          </button>
          {status === "active" && (
            <button
              type="button"
              onClick={() => setConfirmFinish(true)}
              disabled={!sessionId}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-surface disabled:opacity-50"
            >
              {tr("finish", lang)}
            </button>
          )}
        </div>
      </header>

      {/* The modelling phases are tracked for teachers and researchers only, not shown to students. */}

      {/* conversation */}
      <section aria-live="polite" className="flex-1 space-y-3 overflow-y-auto py-4">
        {task && (
          <article className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{task.statement}</p>
            {task.image && <TaskImage src={task.image} />}
          </article>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} msg={m} youLabel={tr("you", lang)} />
        ))}
        {draft !== null && (
          <Bubble msg={{ role: "tutor", content: draft || tr("thinking", lang) }} youLabel="" pending={!draft} />
        )}
        {status === "done" && (
          <div className="rounded-2xl bg-ok-soft p-4 text-center text-ok">
            <p className="font-medium">{tr("finished", lang, gender)}</p>
            <Link href="/student/tasks" className="mt-2 inline-block underline">
              {tr("backToTasks", lang)}
            </Link>
          </div>
        )}
        <div ref={bottom} />
      </section>

      {/* composer */}
      {status === "active" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="border-t border-line py-3"
        >
          {error && <p className="mb-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              id="message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              maxLength={4000}
              placeholder={tr("placeholder", lang, gender)}
              disabled={!sessionId}
              className="min-h-[3rem] flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 leading-relaxed"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending || !sessionId}
              className="rounded-xl bg-accent px-5 py-3 font-semibold text-white hover:bg-accent-strong disabled:opacity-40"
            >
              {tr("send", lang)}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">{tr("enterHint", lang)}</p>
        </form>
      )}

      <Modal open={showTask} onClose={() => setShowTask(false)} title={task?.title ?? ""} closeLabel={tr("close", lang)}>
        <div lang={lang}>
          <p className="leading-relaxed whitespace-pre-wrap">{task?.statement}</p>
          {task?.image && <TaskImage src={task.image} />}
        </div>
      </Modal>

      <Modal open={confirmFinish} onClose={() => setConfirmFinish(false)} title={tr("finish", lang)} closeLabel={tr("close", lang)}>
        <p>{tr("finishConfirm", lang, gender)}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={finish} className="rounded-lg bg-accent px-4 py-2 font-medium text-white">
            {tr("yesFinish", lang)}
          </button>
          <button type="button" onClick={() => setConfirmFinish(false)} className="rounded-lg border border-line px-4 py-2">
            {tr("keepWorking", lang)}
          </button>
        </div>
      </Modal>
    </main>
  );
}

function Bubble({ msg, youLabel, pending }: { msg: Msg; youLabel: string; pending?: boolean }) {
  const mine = msg.role === "student";
  return (
    <div className={`flex ${mine ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed whitespace-pre-wrap ${
          mine ? "rounded-ss-sm bg-accent text-white" : "rounded-se-sm bg-max text-ink"
        } ${pending ? "animate-pulse text-muted" : ""}`}
      >
        <span className={`mb-0.5 block text-[11px] font-semibold ${mine ? "text-white/75" : "text-accent"}`}>
          {mine ? youLabel : "MAX"}
        </span>
        {msg.content}
      </div>
    </div>
  );
}

function TaskImage({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" onError={() => setOk(false)} className="mt-3 max-h-72 rounded-lg border border-line" />;
}
