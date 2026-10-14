"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readStudent, STUDENT_KEY, tr, useStudent } from "@/lib/i18n";
import { MaxMascot } from "@/components/MaxMascot";
import { BackButton } from "@/components/BackButton";

type TaskCard = { id: string; title: string; statement: string; card: { image: string | null; question?: string } | null };

// Each task gets its own colour, so the library feels like a set of notebook stickers.
const TINTS = [
  { band: "bg-sun", soft: "bg-sun-soft" },
  { band: "bg-coral", soft: "bg-coral-soft" },
  { band: "bg-mint", soft: "bg-mint-soft" },
  { band: "bg-sky", soft: "bg-sky-soft" },
];

export default function TaskLibrary() {
  const router = useRouter();
  const me = useStudent();
  const [tasks, setTasks] = useState<TaskCard[] | null>(null);

  useEffect(() => {
    const s = readStudent();
    if (!s) {
      router.replace("/student");
      return;
    }
    fetch(`/api/tasks?lang=${s.lang}&class=${encodeURIComponent(s.classCode)}`)
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks))
      .catch(() => setTasks([]));
  }, [router]);

  if (!me) return null;
  const { lang, gender } = me;

  return (
    <div className="graph-paper min-h-screen">
    <main lang={lang} className="mx-auto max-w-3xl px-4 py-6">
      <BackButton fallback="/student" label={tr("back", lang)} className="mb-5" />
      <header className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MaxMascot size={56} />
          <div>
            <h1 className="text-3xl">{tr("tasksTitle", lang)}</h1>
            <p className="mt-1 text-muted">{tr("tasksIntro", lang, gender)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.removeItem(STUDENT_KEY);
            } catch {}
            router.push("/student");
          }}
          className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-muted hover:border-accent"
        >
          {tr("logout", lang)} · {me.nickname}
        </button>
      </header>

      {!tasks ? (
        <p className="text-muted">{tr("loading", lang)}</p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {tasks.map((t, i) => {
            const tint = TINTS[i % TINTS.length];
            return (
              <li key={t.id}>
                <Link
                  href={`/student/task/${t.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-3xl border-2 border-ink bg-surface shadow-[0_5px_0_var(--color-ink)] transition active:translate-y-1 active:shadow-[0_1px_0_var(--color-ink)]"
                >
                  <div className={`flex h-36 items-center justify-center ${tint.soft}`}>
                    {t.card?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.card.image} alt="" className="h-full w-full object-contain p-2" />
                    ) : (
                      <span aria-hidden className="text-5xl">📐</span>
                    )}
                  </div>
                  <div className={`h-2 ${tint.band}`} />
                  <div className="flex flex-1 flex-col p-5">
                    <h2 className="text-xl">{t.title}</h2>
                    <span className="mt-4 self-start rounded-full bg-accent px-4 py-1.5 font-display text-sm font-semibold text-white group-hover:bg-accent-strong">
                      {tr("start", lang)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
    </div>
  );
}
