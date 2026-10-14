"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readStudent, STUDENT_KEY, tr, useStudent } from "@/lib/i18n";

type TaskCard = { id: string; title: string; statement: string };

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
    <main lang={lang} className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tr("tasksTitle", lang)}</h1>
          <p className="mt-1 text-muted">{tr("tasksIntro", lang, gender)}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.removeItem(STUDENT_KEY);
            } catch {}
            router.push("/student");
          }}
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-surface"
        >
          {tr("logout", lang)} · {me.nickname}
        </button>
      </header>

      {!tasks ? (
        <p className="text-muted">{tr("loading", lang)}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link
                href={`/student/task/${t.id}`}
                className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition hover:border-accent hover:shadow-sm"
              >
                <h2 className="text-lg font-semibold">{t.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm text-muted">{t.statement}</p>
                <span className="mt-4 text-sm font-medium text-accent">{tr("start", lang)} ←</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
