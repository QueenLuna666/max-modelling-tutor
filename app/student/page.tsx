"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { readUiLang, saveUiLang, STUDENT_KEY, tr, type UiGender, type UiLang } from "@/lib/i18n";
import { BackButton } from "@/components/BackButton";
import { MaxMascot } from "@/components/MaxMascot";

export default function StudentLoginPage() {
  return (
    <Suspense>
      <StudentLogin />
    </Suspense>
  );
}

// ?code=ABC123 fills the class code (from the class QR); ?task=<id> opens that task after login.
function StudentLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [lang, setLangState] = useState<UiLang>("he");
  useEffect(() => {
    // The language chosen on the home page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLangState(readUiLang());
  }, []);
  const setLang = (l: UiLang) => {
    setLangState(l);
    saveUiLang(l);
  };
  const [classCode, setClassCode] = useState(params.get("code") ?? "");
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<UiGender | null>(null);
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!classCode.trim() || !nickname.trim() || !gender) {
      setError(tr("missingFields", lang));
      return;
    }
    try {
      sessionStorage.setItem(
        STUDENT_KEY,
        JSON.stringify({ classCode: classCode.trim().toUpperCase(), nickname: nickname.trim(), gender, lang }),
      );
    } catch {
      /* storage blocked: the task page will send the student back here */
    }
    const task = params.get("task");
    router.push(task && /^[\w-]+$/.test(task) ? `/student/task/${task}` : "/student/tasks");
  }

  const g = gender ?? "male";
  return (
    <div className="graph-paper min-h-screen">
    <main lang={lang} className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <BackButton fallback="/" label={tr("back", lang)} className="mb-6 self-start" />
      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <MaxMascot size={64} wave />
          <h1 className="text-3xl">{tr("studentLogin", lang)}</h1>
        </div>
        <div role="group" aria-label={tr("language", lang)} className="flex rounded-full border border-line bg-surface p-0.5 text-sm">
          {(["he", "ar"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`rounded-full px-3 py-1 ${lang === l ? "bg-accent text-white" : "text-muted"}`}
            >
              {l === "he" ? "עברית" : "العربية"}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-3xl border-2 border-ink bg-surface p-6 shadow-[0_6px_0_var(--color-ink)]">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">{tr("classCode", lang)}</span>
          <input
            id="classCode"
            value={classCode}
            onChange={(e) => setClassCode(e.target.value)}
            dir="ltr"
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full rounded-xl border-2 border-line bg-sun-soft px-3 py-2.5 font-display text-2xl tracking-[0.2em] uppercase focus:border-accent"
            placeholder="DEMO1"
          />
          <span className="block text-xs text-muted">{tr("classCodeHint", lang)}</span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">{tr("nickname", lang)}</span>
          <input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            autoComplete="off"
            className="w-full rounded-xl border-2 border-line bg-paper px-3 py-2.5 text-lg focus:border-accent"
          />
          <span className="block text-xs text-muted">{tr("nicknameHint", lang)}</span>
        </label>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">{tr("addressAs", lang)}</legend>
          <div className="grid grid-cols-2 gap-2 pt-1.5">
            {(["male", "female"] as const).map((v) => (
              <label
                key={v}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 font-display text-lg ${
                  gender === v ? "border-accent bg-accent text-white" : "border-line bg-paper hover:border-accent/50"
                }`}
              >
                <input
                  type="radio"
                  name="gender"
                  id={`gender-${v}`}
                  value={v}
                  checked={gender === v}
                  onChange={() => setGender(v)}
                  className="sr-only"
                />
                {tr(v === "male" ? "boy" : "girl", lang)}
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}

        <button type="submit" className="btn-chunky w-full rounded-2xl bg-accent px-4 py-3.5 text-lg text-white hover:bg-accent-strong">
          {tr("enter", lang, g)}
        </button>
      </form>
    </main>
    </div>
  );
}
