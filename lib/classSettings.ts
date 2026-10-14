// Per-class settings (classes.settings, jsonb). Every student-facing feature has a switch here,
// so teachers and researchers turn features on and off per class without touching code.
// To add a feature: add it to FEATURES below, then read `settings.features.<key>` where it is used.

export const FEATURES = {
  readAloud: { he: "הקראה בקול", desc: "כפתור 🔊 שמקריא את המשימה ואת התשובות של MAX", default: true },
  voiceInput: { he: "דיבור במקום הקלדה", desc: "כפתור 🎤: התלמיד/ה מדבר/ת והטקסט נכתב לבד", default: true },
  simpler: { he: "״תסביר לי פשוט יותר״", desc: "כפתור שמבקש מ-MAX לנסח שוב במילים פשוטות וקצרות", default: true },
  bigText: { he: "הגדלת טקסט וגופן קריא", desc: "כפתורי A+ ו-Aa לנוחות קריאה", default: true },
} as const;

export type FeatureKey = keyof typeof FEATURES;
export type HintCap = "light" | "medium" | "strong";

export type ClassSettings = {
  tasks: string[] | null; // null = every published task
  features: Record<FeatureKey, boolean>;
  maxHint: HintCap;
};

export function normalizeSettings(raw: unknown): ClassSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<ClassSettings> & { features?: Record<string, unknown> };
  const features = {} as Record<FeatureKey, boolean>;
  for (const k of Object.keys(FEATURES) as FeatureKey[]) {
    const v = r.features?.[k];
    features[k] = typeof v === "boolean" ? v : FEATURES[k].default;
  }
  return {
    tasks: Array.isArray(r.tasks) ? r.tasks.map(String) : null,
    features,
    maxHint: r.maxHint === "light" || r.maxHint === "medium" ? r.maxHint : "strong",
  };
}

// The same tolerant code match the login uses (DEMO1 vs DEM01).
export function codeVariants(code: string): string[] {
  const c = code.trim().toUpperCase();
  return [...new Set([c, c.replace(/0/g, "O"), c.replace(/O/g, "0"), c.replace(/I/g, "1"), c.replace(/1/g, "I")])];
}
