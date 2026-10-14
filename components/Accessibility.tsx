"use client";
// Accessibility helpers for the student screen, each one switchable per class (lib/classSettings.ts):
//  - read aloud (browser speech synthesis, Hebrew / Arabic voices of the device)
//  - voice input (browser speech recognition: the student talks, the text is typed)
//  - text size and a more spaced, readable text style
import { useCallback, useEffect, useRef, useState } from "react";

const SPEECH_LANG = { he: "he-IL", ar: "ar-SA", en: "en-US" } as const;
const MIC_LANG = { he: "he-IL", ar: "ar-IL", en: "en-US" } as const;
type L = keyof typeof SPEECH_LANG;

function clean(text: string) {
  return text.replace(/\*\*/g, "").replace(/[👋✨🤔📷]/gu, "");
}

export function useSpeech(lang: L) {
  const [speaking, setSpeaking] = useState<string | null>(null); // id of what is being read
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const voice = voices.find((v) => v.lang.replace("_", "-").toLowerCase().startsWith(lang)) ?? null;

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(null);
  }, [supported]);

  const speak = useCallback(
    (id: string, text: string) => {
      if (!supported) return false;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean(text));
      u.lang = SPEECH_LANG[lang];
      if (voice) u.voice = voice;
      u.rate = 0.92;
      u.onend = () => setSpeaking((s) => (s === id ? null : s));
      u.onerror = () => setSpeaking((s) => (s === id ? null : s));
      setSpeaking(id);
      window.speechSynthesis.speak(u);
      return true;
    },
    [supported, lang, voice],
  );

  return { supported, hasVoice: !!voice || voices.length === 0, speaking, speak, stop };
}

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

export function useDictation(lang: L, onText: (finalText: string, interim: string) => void) {
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const Ctor =
    typeof window === "undefined"
      ? null
      : ((window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition ??
        null);

  const stop = useCallback(() => {
    rec.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!Ctor) return false;
    const r = new Ctor();
    r.lang = MIC_LANG[lang];
    r.interimResults = true;
    r.continuous = true;
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript + " ";
        else interim += res[0].transcript;
      }
      onText(finalText, interim);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
    return true;
  }, [Ctor, lang, onText]);

  useEffect(() => () => rec.current?.stop(), []);

  return { supported: !!Ctor, listening, start, stop };
}

// Text size (90%–150%) and a spaced reading style, remembered on this device.
const PREFS_KEY = "max_text_prefs";

export function useTextPrefs() {
  const [scale, setScale] = useState(1);
  const [readable, setReadable] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
      // Restoring a saved preference from the device once, after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (typeof p.scale === "number") setScale(p.scale);
      if (typeof p.readable === "boolean") setReadable(p.readable);
    } catch {}
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${Math.round(scale * 100)}%`;
    root.classList.toggle("readable-text", readable);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ scale, readable }));
    } catch {}
    return () => {
      root.style.fontSize = "";
      root.classList.remove("readable-text");
    };
  }, [scale, readable]);

  return {
    scale,
    readable,
    bigger: () => setScale((s) => Math.min(1.5, +(s + 0.1).toFixed(2))),
    smaller: () => setScale((s) => Math.max(0.9, +(s - 0.1).toFixed(2))),
    toggleReadable: () => setReadable((r) => !r),
  };
}

export function SpeakButton({ active, onClick, label, stopLabel, small }: { active: boolean; onClick: () => void; label: string; stopLabel: string; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? stopLabel : label}
      title={active ? stopLabel : label}
      className={`inline-flex items-center gap-1 rounded-full ${small ? "px-1.5 py-0.5 text-xs" : "px-2.5 py-1 text-sm"} ${
        active ? "bg-accent text-white" : "text-accent hover:bg-accent-soft"
      }`}
    >
      <span aria-hidden>{active ? "⏹" : "🔊"}</span>
      {!small && <span>{active ? stopLabel : label}</span>}
    </button>
  );
}
