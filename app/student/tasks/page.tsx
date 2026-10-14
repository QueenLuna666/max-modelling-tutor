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
    if (!s || !s.phone) {
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
    <div className="graph-paper min-h-svh">
    <main lang={lang} className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      <nav aria-label={tr("tasksTitle", lang)} className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
        <BackButton fallback="/student" label={tr("back", lang)} className="min-h-11" />
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.removeItem(STUDENT_KEY);
            } catch {}
            router.push("/student");
          }}
          className="min-h-11 max-w-full rounded-full border border-line bg-surface px-4 py-2 text-start text-sm text-muted transition-colors hover:border-accent hover:text-ink [overflow-wrap:anywhere]"
        >
          {tr("logout", lang)} · {me.nickname}
        </button>
      </nav>
      <header className="mb-8 flex items-start gap-4 sm:mb-10 sm:items-center sm:gap-5">
        <span aria-hidden="true" className="shrink-0"><MaxMascot size={72} className="h-14 w-14 sm:h-20 sm:w-20" /></span>
        <div className="min-w-0 space-y-2">
          <h1 className="text-3xl sm:text-4xl">{tr("tasksTitle", lang)}</h1>
          <p className="max-w-prose leading-relaxed text-muted sm:text-lg">{tr("tasksIntro", lang, gender)}</p>
        </div>
      </header>

      {!tasks ? (
        <p className="text-muted">{tr("loading", lang)}</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2">
          {tasks.map((t, i) => {
            const tint = TINTS[i % TINTS.length];
            return (
              <li key={t.id} className="min-w-0">
                <Link
                  href={`/student/task/${t.id}`}
                  className="group flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border-2 border-ink bg-surface shadow-[0_5px_0_var(--color-ink)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_7px_0_var(--color-ink)] active:translate-y-1 active:shadow-[0_1px_0_var(--color-ink)]"
                >
                  <div className={`flex h-40 items-center justify-center sm:h-48 ${tint.soft}`}>
                    {t.card?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.card.image} alt="" className="h-full w-full object-contain p-2" />
                    ) : (
                      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-16 w-16 text-ink" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
                        <path d="M12 10v44h44L12 10Z" /><path d="M22 32v12h12L22 32Z" /><path d="M12 22h5m-5 10h5m-5 10h5m7 12v-5m10 5v-5m10 5v-5" />
                      </svg>
                    )}
                  </div>
                  <div className={`h-2 ${tint.band}`} />
                  <div className="flex flex-1 flex-col gap-6 p-6 sm:p-7">
                    <h2 className="text-2xl [overflow-wrap:anywhere]">{t.title}</h2>
                    <span className="mt-auto inline-flex min-h-12 items-center self-start rounded-full bg-accent px-5 py-3 font-display text-base font-semibold text-white transition-colors group-hover:bg-accent-strong">
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
