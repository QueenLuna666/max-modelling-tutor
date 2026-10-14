// The research team's hint scale (HINT_GUIDELINES_REPORT, 14.10.2026): H0–H4.
// Stored values (messages.hint_level) keep their short names; the H-codes are what people see.
//   none  = H0 independent work — precise acknowledgement or an invitation to continue, no content hint
//   light = H1 light hint      — points the thinking without solution content (meaning, goal, unit, self-check)
//   medium= H2 focused hint    — narrows the search: two quantities, one line, one distinction
//   strong= H3 partial structure — reveals a local relation or a frame with a missing part
//   step  = H4 small-step guidance — explains a basic concept, a solved example with OTHER numbers, or a limited choice
export const HINT_ORDER = ["none", "light", "medium", "strong", "step"] as const;
export type HintName = (typeof HINT_ORDER)[number];

export const HINT_CODE: Record<string, string> = { none: "H0", light: "H1", medium: "H2", strong: "H3", step: "H4" };
export const HINT_HE: Record<string, string> = {
  none: "H0 עבודה עצמאית",
  light: "H1 רמז קל",
  medium: "H2 רמז ממוקד",
  strong: "H3 מבנה חלקי",
  step: "H4 ליווי צעד קטן",
};
export const HINT_AR: Record<string, string> = {
  none: "H0 عمل مستقل",
  light: "H1 تلميح خفيف",
  medium: "H2 تلميح مركّز",
  strong: "H3 بنية جزئية",
  step: "H4 مرافقة خطوة صغيرة",
};
export const hintRank = (h: string | null | undefined) => (h ? HINT_ORDER.indexOf(h as HintName) : -1);
