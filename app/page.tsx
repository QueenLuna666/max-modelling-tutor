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
    staffGo: "להתחברות",
    lab: "מעבדת MtED, הפקולטה לחינוך למדע וטכנולוגיה, הטכניון",
  },
  ar: {
    intro: "نأخذ موقفًا من الحياة ونتساعد ب MAX لنحوّله إلى نموذج رياضي.",
    students: "دخول الطلاب",
    studentsSub: "برمز الصف واسمك",
    go: "يلّا نبدأ",
    staff: "دخول الطاقم",
    staffSub: "للمعلّمين والباحثات.",
    staffGo: "تسجيل الدخول",
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
    <main lang={lang} className="graph-paper min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-6">
        <div className="flex justify-end">
          <div role="group" aria-label="שפה / اللغة" className="flex rounded-full border border-line bg-surface p-0.5 text-sm">
            {(["he", "ar"] as const).map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                onClick={() => choose(l)}
                aria-pressed={lang === l}
                className={`rounded-full px-4 py-1.5 ${lang === l ? "bg-accent text-white" : "text-muted"}`}
              >
                {l === "he" ? "עברית" : "العربية"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-10">
          <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <MaxMascot size={96} wave />
            <div className="space-y-2">
              <h1 className="font-display text-5xl font-bold text-accent sm:text-6xl">MAX</h1>
              <p className="max-w-[44ch] text-xl leading-relaxed">{t.intro}</p>
            </div>
          </header>

          <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            <Link
              href="/student"
              className="group rounded-3xl border-2 border-ink bg-sun p-6 shadow-[0_5px_0_var(--color-ink)] transition active:translate-y-1 active:shadow-[0_1px_0_var(--color-ink)]"
            >
              <h2 className="text-3xl">{t.students}</h2>
              <p className="mt-2">{t.studentsSub}</p>
              <span className="mt-5 inline-block rounded-full bg-ink px-4 py-1.5 font-display text-sm font-semibold text-white group-hover:bg-accent">
                {t.go}
              </span>
            </Link>
            <Link href="/staff/login" className="group rounded-3xl border border-line bg-surface p-6 transition hover:border-accent">
              <h2 className="text-2xl">{t.staff}</h2>
              <p className="mt-2 text-muted">{t.staffSub}</p>
              <span className="mt-4 inline-block text-sm font-medium text-accent group-hover:underline">{t.staffGo}</span>
            </Link>
          </div>
        </div>

        <p className="text-xs text-muted">{t.lab}</p>
      </div>
    </main>
  );
}
