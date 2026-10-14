"use client";
// Language of the staff area (Hebrew / Arabic). Shares the device setting with the home page.
// Usage in a component:  const { L, lang } = useStaffLang();  …  {L("כיתות", "الصفوف")}
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { PHASES } from "./framework";
import { readUiLang, saveUiLang, type UiLang } from "./i18n";

type Ctx = { lang: UiLang; setLang: (l: UiLang) => void };
const StaffLangContext = createContext<Ctx>({ lang: "he", setLang: () => {} });

export function StaffLangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<UiLang>("he");
  useEffect(() => {
    // Restore the language chosen earlier on this device.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLangState(readUiLang());
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: UiLang) => {
    setLangState(l);
    saveUiLang(l);
  }, []);
  return <StaffLangContext.Provider value={{ lang, setLang }}>{children}</StaffLangContext.Provider>;
}

export function useStaffLang() {
  const { lang, setLang } = useContext(StaffLangContext);
  const L = useCallback((he: string, ar: string) => (lang === "ar" ? ar : he), [lang]);
  // Phase names in the chosen language (the server sends Hebrew).
  const phase = useCallback(
    (id: string | null | undefined, fallback = "") => {
      const p = PHASES.find((x) => x.id === id);
      return p ? (lang === "ar" ? p.ar : p.he) : fallback || id || "";
    },
    [lang],
  );
  const locale = lang === "ar" ? "ar-u-nu-latn" : "he-IL";
  return { lang, setLang, L, phase, locale };
}

export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang } = useStaffLang();
  return (
    <div role="group" aria-label="שפה / اللغة" className={`flex rounded-full border border-line bg-surface p-0.5 text-xs ${className}`}>
      {(["he", "ar"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-2.5 py-1 ${lang === l ? "bg-accent text-white" : "text-muted"}`}
        >
          {l === "he" ? "עברית" : "العربية"}
        </button>
      ))}
    </div>
  );
}
