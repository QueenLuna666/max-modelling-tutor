"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MaxMascot } from "@/components/MaxMascot";
import { readUiLang, saveUiLang, type UiLang } from "@/lib/i18n";

const TEXT = {
  he: {
    intro: "לוקחים מצב מהעולם האמיתי ונעזרים ב-MAX כדי להפוך אותו למודל מתמטי.",
    students: "כניסה לתלמידים",
    studentsSub: "עם קוד הכיתה והשם שלך",
    go: "יאללה, מתחילים",
    staff: "כניסת צוות",
    staffSub: "למורים ולחוקרות.",
    teachers: "כניסת מורים",
    researchers: "כניסת חוקרות",
    lab: "מעבדת MtED, הפקולטה לחינוך למדע וטכנולוגיה, הטכניון",
  },
  ar: {
    intro: "نأخذ موقفًا من الحياة ونتساعد ب MAX لنحوّله إلى نموذج رياضي.",
    students: "دخول الطلاب",
    studentsSub: "برمز الصف واسمك",
    go: "يلّا نبدأ",
    staff: "دخول الطاقم",
    staffSub: "للمعلّمين والباحثات.",
    teachers: "دخول المعلّمين",
    researchers: "دخول الباحثات",
    lab: "مختبر MtED، كلية تدريس العلوم والتكنولوجيا، التخنيون",
  },
};

export default function Home() {
  const [lang, setLang] = useState<UiLang>("he");
  useEffect(() => {
    // Restore the language chosen earlier on this device.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLang(readUiLang());
  }, []);
  const t = TEXT[lang];

  function choose(l: UiLang) {
    setLang(l);
    saveUiLang(l);
  }

  return (
    <main lang={lang} className="graph-paper min-h-svh">
      <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-8 px-4 py-6 sm:px-8">
        <div className="flex justify-end">
          <div role="group" aria-label="שפה / اللغة" className="flex rounded-full border border-line bg-surface p-0.5 text-sm">
            {(["he", "ar"] as const).map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                onClick={() => choose(l)}
                aria-pressed={lang === l}
                className={`min-h-11 min-w-16 rounded-full px-4 py-2.5 font-medium transition-colors ${lang === l ? "bg-accent text-white" : "text-muted hover:bg-paper hover:text-ink"}`}
              >
                {l === "he" ? "עברית" : "العربية"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-8 py-4 sm:gap-10 sm:py-12">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
            <div className="flex shrink-0 items-center gap-4 sm:gap-5">
              <span aria-hidden="true" className="shrink-0">
                <MaxMascot size={96} wave className="h-20 w-20 sm:h-28 sm:w-28" />
              </span>
              <h1 dir="ltr" className="font-display text-5xl font-bold text-accent sm:text-7xl">MAX</h1>
            </div>
            <p className="min-w-0 max-w-[38ch] text-xl leading-relaxed sm:text-2xl">{t.intro}</p>
          </header>

          <div className="grid items-stretch gap-5 sm:grid-cols-5 sm:gap-6">
            <Link
              href="/student"
              className="group flex min-w-0 flex-col justify-between gap-8 rounded-3xl border-2 border-ink bg-sun p-6 shadow-[0_5px_0_var(--color-ink)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_7px_0_var(--color-ink)] active:translate-y-1 active:shadow-[0_1px_0_var(--color-ink)] sm:col-span-3 sm:p-8"
            >
              <div className="space-y-2">
                <h2 className="text-3xl sm:text-4xl">{t.students}</h2>
                <p className="text-base leading-relaxed sm:text-lg">{t.studentsSub}</p>
              </div>
              <span className="flex min-h-12 w-fit items-center gap-4 rounded-full bg-ink px-5 py-3 font-display text-base font-semibold text-white transition-colors group-hover:bg-accent">
                {t.go}
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5m7-7-7 7 7 7" />
                </svg>
              </span>
            </Link>
            <div className="flex min-w-0 flex-col justify-between gap-6 rounded-3xl border border-line bg-surface p-6 sm:col-span-2 sm:p-8">
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl">{t.staff}</h2>
                <p className="leading-relaxed text-muted">{t.staffSub}</p>
              </div>
              <div className="flex flex-col gap-3">
                <Link href="/staff/login?as=teacher" className="flex min-h-12 items-center justify-center rounded-xl border-2 border-accent px-4 py-2.5 text-center font-display font-semibold text-accent transition-colors hover:bg-accent-soft">
                  {t.teachers}
                </Link>
                <Link href="/staff/login?as=researcher" className="flex min-h-12 items-center justify-center rounded-xl border-2 border-ink px-4 py-2.5 text-center font-display font-semibold text-ink transition-colors hover:bg-paper">
                  {t.researchers}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <footer className="border-t border-line pt-5 text-sm leading-relaxed text-muted">
          <p>{t.lab}</p>
        </footer>
      </div>
    </main>
  );
}
