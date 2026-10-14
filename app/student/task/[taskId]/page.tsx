"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { readStudent, tr, useStudent, type StudentLogin } from "@/lib/i18n";
import { sendMessage, startSession, type StartResult } from "@/lib/chatClient";
import { Modal } from "@/components/Modal";
import { TaskCard } from "@/components/TaskCard";
import { SpeakButton, useDictation, useSpeech, useTextPrefs } from "@/components/Accessibility";
import { MaxMascot } from "@/components/MaxMascot";
import { BackButton } from "@/components/BackButton";
import { MessageText } from "@/components/MessageText";

type Features = { readAloud: boolean; voiceInput: boolean; simpler: boolean; bigText: boolean; pictures?: boolean };

type Msg = { role: "student" | "tutor"; content: string; move?: string | null };
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
  const [features, setFeatures] = useState<Features | null>(null);
  const [autoRead, setAutoRead] = useState(false);
  const [micNote, setMicNote] = useState("");
  const dictBase = useRef("");
  const lastReplyAt = useRef<number>(0); // set when MAX's reply arrives
  const bottom = useRef<HTMLDivElement>(null);

  // Start a new session, or resume the one saved for this task (page refresh).
  useEffect(() => {
    const s = readStudent();
    if (!s || !s.phone) {
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

  // Which helper features the teacher turned on for this class.
  useEffect(() => {
    const s = readStudent();
    if (!s) return;
    fetch(`/api/class-settings?code=${encodeURIComponent(s.classCode)}`)
      .then((r) => r.json())
      .then((d) => setFeatures(d.features))
      .catch(() => setFeatures({ readAloud: true, voiceInput: true, simpler: true, bigText: true, pictures: true }));
  }, []);

  const speechLang = me?.lang ?? "he";
  const speech = useSpeech(speechLang);
  const text = useTextPrefs();
  const onDictation = useCallback((finalText: string, interim: string) => {
    setInput((dictBase.current + " " + finalText + interim).trimStart());
  }, []);
  const dictation = useDictation(speechLang, onDictation);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, draft]);

  const send = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || !sessionId || sending || status !== "active" || !me) return;
    if (dictation.listening) dictation.stop();
    setSending(true);
    setError("");
    setInput("");
    setMessages((m) => [...m, { role: "student", content: text }]);
    setDraft("");
    try {
      const since = lastReplyAt.current ? Date.now() - lastReplyAt.current : null;
      const { reply, move } = await sendMessage(sessionId, text, since, (soFar) =>
        setDraft(soFar),
      );
      setMessages((m) => [...m, { role: "tutor", content: reply, move }]);
      if (move === "close") {
        // The student chose to finish: MAX closed the conversation.
        try {
          sessionStorage.removeItem(sessionKey(taskId));
        } catch {}
        setStatus("done");
      }
      if (autoRead) speech.speak(`m-reply-${Date.now()}`, reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("error", me.lang));
    } finally {
      setDraft(null);
      setSending(false);
      lastReplyAt.current = Date.now();
    }
  }, [input, sessionId, sending, status, me, autoRead, speech, dictation, taskId]);

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
    <div className="graph-paper">
    <main lang={lang} className="mx-auto flex h-dvh max-w-3xl flex-col px-4">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
        <div className="min-w-0">
          <BackButton fallback="/student/tasks" label={tr("backToTasks", lang)} className="mb-1.5 py-1 text-xs" />
          <h1 className="truncate text-xl">{task?.title ?? tr("loading", lang)}</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowTask(true)}
            disabled={!task}
            className="rounded-full border-2 border-accent bg-surface px-3 py-1.5 font-display text-sm font-semibold text-accent hover:bg-accent-soft disabled:opacity-50"
          >
            {tr("showTask", lang)}
          </button>
          {status === "active" && (
            <button
              type="button"
              onClick={() => setConfirmFinish(true)}
              disabled={!sessionId}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-muted hover:border-ok hover:text-ok disabled:opacity-50"
            >
              {tr("finish", lang)}
            </button>
          )}
        </div>
      </header>

      {/* The modelling phases are tracked for teachers and researchers only, not shown to students. */}

      {/* helper tools (each one switchable per class by the teacher) */}
      {features && (features.readAloud || features.bigText) && (
        <div role="toolbar" aria-label={tr("tools", lang)} className="flex flex-wrap items-center gap-1.5 border-b border-line py-2 text-sm">
          {features.readAloud && task && (
            <>
              <SpeakButton
                active={speech.speaking === "task"}
                onClick={() =>
                  speech.speaking === "task"
                    ? speech.stop()
                    : speech.speak("task", [task.card?.title, task.card?.definition, ...(task.card?.points ?? []), task.card?.question ?? task.statement].filter(Boolean).join(". "))
                }
                label={tr("readTask", lang)}
                stopLabel={tr("stopReading", lang)}
              />
              <label className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-muted hover:bg-surface">
                <input type="checkbox" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} className="accent-[var(--color-accent)]" />
                {tr("autoRead", lang)}
              </label>
              {!speech.hasVoice && <span className="text-xs text-warn">{tr("noVoice", lang)}</span>}
            </>
          )}
          {features.bigText && (
            <span className="ms-auto flex items-center gap-1">
              <button type="button" onClick={text.smaller} aria-label={tr("smaller", lang)} title={tr("smaller", lang)} className="rounded-full px-2 py-0.5 hover:bg-surface">
                A−
              </button>
              <button type="button" onClick={text.bigger} aria-label={tr("bigger", lang)} title={tr("bigger", lang)} className="rounded-full px-2 py-0.5 text-base font-semibold hover:bg-surface">
                A+
              </button>
              <button
                type="button"
                onClick={text.toggleReadable}
                aria-pressed={text.readable}
                title={tr("readable", lang)}
                className={`rounded-full px-2 py-0.5 ${text.readable ? "bg-accent text-white" : "hover:bg-surface"}`}
              >
                Aa
              </button>
            </span>
          )}
        </div>
      )}

      {/* conversation */}
      <section aria-live="polite" className="flex-1 space-y-3 overflow-y-auto py-4">
        {task && (
          <article className="rounded-3xl border-2 border-ink bg-surface p-5 shadow-[0_4px_0_var(--color-ink)]">
            <TaskCard card={task.card} statement={task.statement} />
          </article>
        )}
        {messages.map((m, i) => (
          <Bubble
            key={i}
            msg={m}
            youLabel={tr("you", lang)}
            drawingLabel={tr("drawing", lang)}
            speak={
              features?.readAloud && m.role === "tutor"
                ? {
                    active: speech.speaking === `m${i}`,
                    toggle: () => (speech.speaking === `m${i}` ? speech.stop() : speech.speak(`m${i}`, m.content)),
                    label: tr("readAloud", lang),
                    stopLabel: tr("stopReading", lang),
                  }
                : undefined
            }
          />
        ))}
        {draft !== null && (
          draft ? (
            <Bubble msg={{ role: "tutor", content: draft }} youLabel="" drawingLabel={tr("drawing", lang)} />
          ) : (
            <WaitingBubble lang={lang} />
          )
        )}
        {status === "active" && !sending && draft === null && messages[messages.length - 1]?.role === "tutor" && messages[messages.length - 1]?.move === "offer_finish" && (
          <div className="flex flex-wrap justify-center gap-3 py-1">
            <button
              type="button"
              onClick={() => send(tr("finishDoneMsg", lang))}
              className="rounded-2xl border-2 border-ok bg-mint-soft px-5 py-2.5 font-display font-semibold text-ok hover:bg-ok hover:text-white"
            >
              {tr("finishDone", lang)}
            </button>
            <button type="button" onClick={() => send(tr("challengeMeMsg", lang))} className="btn-chunky rounded-2xl bg-accent px-5 py-2.5 text-white hover:bg-accent-strong">
              {tr("challengeMe", lang)}
            </button>
          </div>
        )}
        {status === "done" && (
          <div className="flex flex-col items-center rounded-3xl border-2 border-ok bg-mint-soft p-5 text-center text-ok">
            <MaxMascot size={56} wave />
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
          {messages.length > 0 && (features?.simpler || features?.pictures) && (
            <div className="mb-2 flex flex-wrap gap-2">
              {features?.simpler && (
                <button
                  type="button"
                  disabled={sending || !sessionId}
                  onClick={() => send(tr("simplerMsg", lang))}
                  className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  {tr("simpler", lang)}
                </button>
              )}
              {features?.pictures !== false && (
                <button
                  type="button"
                  disabled={sending || !sessionId}
                  onClick={() => send(tr("pictureMsg", lang))}
                  className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  {tr("picture", lang)}
                </button>
              )}
            </div>
          )}
          {dictation.listening && <p className="mb-1 text-sm font-medium text-accent">🎙️ {tr("listening", lang)}</p>}
          {micNote && <p className="mb-1 text-xs text-warn">{micNote}</p>}
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
              className="min-h-[3rem] flex-1 resize-none rounded-2xl border-2 border-line bg-surface px-3 py-2.5 leading-relaxed focus:border-accent"
            />
            {features?.voiceInput && (
              <button
                type="button"
                onClick={() => {
                  setMicNote("");
                  if (dictation.listening) return dictation.stop();
                  dictBase.current = input;
                  if (!dictation.start()) setMicNote(tr("noMic", lang));
                }}
                aria-pressed={dictation.listening}
                aria-label={tr("speak", lang)}
                title={tr("speak", lang)}
                className={`rounded-xl border px-3 py-3 text-lg ${dictation.listening ? "animate-pulse border-accent bg-accent text-white" : "border-line bg-surface hover:bg-accent-soft"}`}
              >
                🎤
              </button>
            )}
            <button
              type="submit"
              disabled={!input.trim() || sending || !sessionId}
              className="btn-chunky rounded-2xl bg-accent px-5 py-3 text-white hover:bg-accent-strong disabled:opacity-40"
            >
              {tr("send", lang)}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">{tr("enterHint", lang)}</p>
        </form>
      )}

      <Modal open={showTask} onClose={() => setShowTask(false)} title={task?.title ?? ""} closeLabel={tr("close", lang)}>
        <div lang={lang}>{task && <TaskCard card={task.card} statement={task.statement} fullImage={lang === "he" ? task.image : null} />}</div>
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
    </div>
  );
}

// Shown while the analyzer reads the message and MAX prepares its reply.
function WaitingBubble({ lang }: { lang: "he" | "ar" }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const a = setTimeout(() => setStage(1), 2500);
    const b = setTimeout(() => setStage(2), 7000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  const text = tr(stage === 0 ? "reading" : stage === 1 ? "pondering" : "almost", lang);
  return (
    <div className="flex flex-row-reverse items-end justify-start gap-2" role="status" aria-live="polite">
      <MaxMascot size={34} className="mb-1 shrink-0" />
      <div className="flex items-center gap-2 rounded-3xl rounded-se-md border-2 border-accent/25 bg-surface px-4 py-2.5 text-muted">
        <span aria-hidden className="flex gap-1">
          <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-accent" />
        </span>
        {text}
      </div>
    </div>
  );
}

type SpeakCtl = { active: boolean; toggle: () => void; label: string; stopLabel: string };

function Bubble({ msg, youLabel, pending, speak, drawingLabel }: { msg: Msg; youLabel: string; pending?: boolean; speak?: SpeakCtl; drawingLabel?: string }) {
  const mine = msg.role === "student";
  return (
    <div className={`flex items-end gap-2 ${mine ? "justify-start" : "flex-row-reverse justify-start"}`}>
      {!mine && <MaxMascot size={34} className="mb-1 shrink-0" />}
      <div
        className={`max-w-[85%] rounded-3xl px-4 py-2.5 leading-relaxed ${
          mine ? "rounded-ss-md bg-accent text-white" : "rounded-se-md border-2 border-accent/25 bg-surface text-ink"
        } ${pending ? "animate-pulse text-muted" : ""}`}
      >
        <span className={`mb-0.5 flex items-center justify-between gap-2 text-[11px] font-semibold ${mine ? "text-white/75" : "text-accent"}`}>
          {mine ? youLabel : "MAX"}
          {speak && <SpeakButton small active={speak.active} onClick={speak.toggle} label={speak.label} stopLabel={speak.stopLabel} />}
        </span>
        <MessageText text={msg.content} drawingLabel={drawingLabel} />
      </div>
    </div>
  );
}
