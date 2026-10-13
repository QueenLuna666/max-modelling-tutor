"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { STUDENT_KEY, tr, type UiGender, type UiLang } from "@/lib/i18n";

export default function StudentLogin() {
  const router = useRouter();
  const [lang, setLang] = useState<UiLang>("he");
  const [classCode, setClassCode] = useState("");
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
    router.push("/student/tasks");
  }

  const g = gender ?? "male";
  return (
    <main lang={lang} className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tr("studentLogin", lang)}</h1>
        <div role="group" aria-label={tr("language", lang)} className="flex rounded-lg border border-line bg-surface p-0.5 text-sm">
          {(["he", "ar"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`rounded-md px-3 py-1 ${lang === l ? "bg-accent text-white" : "text-muted"}`}
            >
              {l === "he" ? "עברית" : "العربية"}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-line bg-surface p-6">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">{tr("classCode", lang)}</span>
          <input
            id="classCode"
            value={classCode}
            onChange={(e) => setClassCode(e.target.value)}
            dir="ltr"
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-lg tracking-widest uppercase"
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
            className="w-full rounded-lg border border-line bg-paper px-3 py-2.5"
          />
          <span className="block text-xs text-muted">{tr("nicknameHint", lang)}</span>
        </label>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">{tr("addressAs", lang)}</legend>
          <div className="grid grid-cols-2 gap-2 pt-1.5">
            {(["male", "female"] as const).map((v) => (
              <label
                key={v}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 ${
                  gender === v ? "border-accent bg-accent-soft font-medium text-accent-strong" : "border-line"
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

        <button type="submit" className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white hover:bg-accent-strong">
          {tr("enter", lang, g)}
        </button>
      </form>
    </main>
  );
}
