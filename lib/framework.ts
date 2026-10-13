// The lab's modelling framework (MtED, Kohen lab): 6 phases, required skills and expected difficulties.
// Source: "הגדרות ומיומנויות של כל שלב מידול" (sent by the research team, 13.10.2026),
// based on Wess et al. (2021) and the TeDCI table of Schwartz-Aviad & Kohen (2026).
// Shared by every task; a task's phases use the same ids.

export const PHASES = [
  { id: "understanding", he: "הבנת הבעיה", ar: "فهم المشكلة", en: "Understanding the problem", code: "U" },
  { id: "simplifying", he: "פישוט הבעיה", ar: "تبسيط المشكلة", en: "Simplifying the problem", code: "S" },
  { id: "mathematising", he: "מתמטיזציה – בניית מודל מתמטי", ar: "بناء نموذج رياضي", en: "Mathematising – building a model", code: "M" },
  { id: "math_work", he: "עבודה מתמטית", ar: "العمل الرياضي", en: "Working mathematically", code: "W" },
  { id: "interpreting", he: "פירוש התוצאות", ar: "تفسير النتائج", en: "Interpreting the results", code: "I" },
  { id: "validating", he: "תיקוף והערכת המודל", ar: "التحقق من النموذج", en: "Validating and improving the model", code: "V" },
] as const;

export type PhaseId = (typeof PHASES)[number]["id"];

type Coded = { code: string; phase: PhaseId; he: string; en: string };

export const SKILLS: Coded[] = [
  { code: "U1", phase: "understanding", he: "הבנת ההקשר", en: "explains the real or scientific situation" },
  { code: "U2", phase: "understanding", he: "זיהוי מטרת המשימה", en: "states in own words what must be found or decided" },
  { code: "U3", phase: "understanding", he: "זיהוי מידע נתון", en: "identifies given facts, data, conditions" },
  { code: "U4", phase: "understanding", he: "זיהוי מידע חסר", en: "distinguishes given information from information that is needed but missing" },
  { code: "U5", phase: "understanding", he: "הבנת קשרים ראשוניים", en: "describes possible relationships between factors in words" },
  { code: "U6", phase: "understanding", he: "הפעלת ידע קודם", en: "links the situation to relevant prior knowledge" },
  { code: "U7", phase: "understanding", he: "ייצוג ראשוני של הסיטואציה", en: "describes, sketches or organises the situation" },
  { code: "U8", phase: "understanding", he: "ניסוח שאלות הבהרה", en: "asks focused clarification questions" },
  { code: "S1", phase: "simplifying", he: "זיהוי גורמים רלוונטיים", en: "chooses factors that matter for the goal" },
  { code: "S2", phase: "simplifying", he: "הבחנה בין עיקר לטפל", en: "identifies factors that can be ignored or held constant" },
  { code: "S3", phase: "simplifying", he: "זיהוי כמויות ומשתנים", en: "points to quantities that may vary and affect the model" },
  { code: "S4", phase: "simplifying", he: "ניסוח הנחות", en: "states explicit simplifying assumptions" },
  { code: "S5", phase: "simplifying", he: "הצדקת הנחות", en: "explains why an assumption is reasonable" },
  { code: "S6", phase: "simplifying", he: "זיהוי אילוצים", en: "identifies real-world constraints" },
  { code: "S7", phase: "simplifying", he: "הבניית המצב", en: "organises the main factors and their relations" },
  { code: "S8", phase: "simplifying", he: "הערכת השלכות הפישוט", en: "recognises that assumptions affect the results" },
  { code: "M1", phase: "mathematising", he: "הגדרת משתנים מתמטיים", en: "defines variables, their meaning and units" },
  { code: "M2", phase: "mathematising", he: "זיהוי קשרים כמותיים", en: "identifies quantitative dependence between variables" },
  { code: "M3", phase: "mathematising", he: "בחירת ייצוג מתמטי", en: "chooses a suitable equation, function, table, graph or rule" },
  { code: "M4", phase: "mathematising", he: "תרגום יחסים למצגים מתמטיים", en: "expresses real relationships in mathematical notation" },
  { code: "M5", phase: "mathematising", he: "התאמה בין ייצוגים", en: "connects verbal, visual, numeric and algebraic representations" },
  { code: "M6", phase: "mathematising", he: "שילוב הנחות ואילוצים", en: "builds the assumptions into the mathematical model" },
  { code: "M7", phase: "mathematising", he: "הגדרת תחום רלוונטי", en: "identifies reasonable ranges of the variables" },
  { code: "M8", phase: "mathematising", he: "הסברת משמעות המודל", en: "explains how the model represents the situation" },
  { code: "W1", phase: "math_work", he: "תכנון דרך פתרון", en: "chooses a suitable solution strategy" },
  { code: "W2", phase: "math_work", he: "יישום ידע מתמטי", en: "uses appropriate concepts, rules, procedures" },
  { code: "W3", phase: "math_work", he: "ביצוע פעולות וחישובים", en: "carries out calculations correctly" },
  { code: "W4", phase: "math_work", he: "ניתוח קשרים והשתנות", en: "examines how a change in one variable affects others" },
  { code: "W5", phase: "math_work", he: "השוואת חלופות", en: "analyses different cases or values" },
  { code: "W6", phase: "math_work", he: "שימוש בכלים ובייצוגים", en: "uses tables, graphs, calculations or digital tools" },
  { code: "W7", phase: "math_work", he: "בקרה מתמטית", en: "checks correctness and consistency inside the model" },
  { code: "W8", phase: "math_work", he: "הפקת תוצאות מתמטיות", en: "produces a result from the model" },
  { code: "I1", phase: "interpreting", he: "תרגום תוצאות למציאות", en: "explains what the result means in the real situation" },
  { code: "I2", phase: "interpreting", he: "שימוש ביחידות ובמשמעות כמותית", en: "states units and interprets orders of magnitude" },
  { code: "I3", phase: "interpreting", he: "קישור למטרת המשימה", en: "explains how the result answers the original question" },
  { code: "I4", phase: "interpreting", he: "פירוש קשרים ומגמות", en: "explains the real meaning of a dependence or trend" },
  { code: "I5", phase: "interpreting", he: "פירוש תנאי המודל", en: "interprets results in light of the assumptions" },
  { code: "I6", phase: "interpreting", he: "ניסוח מסקנות", en: "states clear conclusions" },
  { code: "I7", phase: "interpreting", he: "הבחנה בין תוצאה להמלצה", en: "distinguishes a mathematical result from a practical decision" },
  { code: "V1", phase: "validating", he: "הערכת סבירות", en: "checks whether results make sense in reality" },
  { code: "V2", phase: "validating", he: "בדיקת התאמה למידע חיצוני", en: "compares results with data, estimates or knowledge" },
  { code: "V3", phase: "validating", he: "הערכת הנחות", en: "examines whether the assumptions fit" },
  { code: "V4", phase: "validating", he: "זיהוי מגבלות המודל", en: "identifies when the model may not hold" },
  { code: "V5", phase: "validating", he: "זיהוי פערים וסתירות", en: "identifies mismatches between results and reality" },
  { code: "V6", phase: "validating", he: "הצעת שיפורים", en: "suggests changes to assumptions, variables or structure" },
  { code: "V7", phase: "validating", he: "השוואת מודלים", en: "compares alternative models" },
  { code: "V8", phase: "validating", he: "הצדקת החלטות", en: "justifies why the model fits or needs change" },
];

export const DIFFICULTIES: Coded[] = [
  { code: "D-U1", phase: "understanding", he: "קושי בהבנת ההקשר", en: "does not understand the real/scientific situation or key concepts" },
  { code: "D-U2", phase: "understanding", he: "קושי בהבנת המשימה", en: "does not understand what the task asks; focuses on another goal" },
  { code: "D-U3", phase: "understanding", he: "קושי באיתור מידע חסר", en: "does not notice missing information or how to obtain/estimate it" },
  { code: "D-U4", phase: "understanding", he: "קושי בהבנת שפה זרה", en: "misunderstands a term or instruction in an unfamiliar language" },
  { code: "D-U5", phase: "understanding", he: "חישובים ללא התייחסות להקשר", en: "calculates without basing it on the situation (not merely calculating early)" },
  { code: "D-S1", phase: "simplifying", he: "קושי בזיהוי משתנים וגורמים רלוונטיים", en: "cannot tell which real factors matter; treats all as equally important" },
  { code: "D-S2", phase: "simplifying", he: "קושי בניסוח הנחות מפשטות", en: "cannot propose assumptions, tries to include everything, or chooses unreasonable assumptions" },
  { code: "D-M1", phase: "mathematising", he: "קושי בהגדרת משתנים מתמטיים", en: "uses symbols without definition, confuses variables" },
  { code: "D-M2", phase: "mathematising", he: "קושי בזיהוי תלות בין משתנים", en: "cannot express how variables depend on each other; unsuitable relation" },
  { code: "D-M3", phase: "mathematising", he: "קושי בבחירת שיטה מתמטית מתאימה", en: "knows the maths but cannot choose how to represent the situation" },
  { code: "D-M4", phase: "mathematising", he: "קושי בשימוש בטכנולוגיה למתמטיזציה", en: "struggles with a digital tool needed to build the model" },
  { code: "D-M5", phase: "mathematising", he: "קושי בהבנה מושגית (מתמטיזציה)", en: "misunderstands a mathematical concept or relation used in the model" },
  { code: "D-M6", phase: "mathematising", he: "חסר ידע מתמטי נדרש", en: "lacks the mathematical knowledge needed (e.g. circumference formula)" },
  { code: "D-W1", phase: "math_work", he: "קושי בביצוע פעולות מתמטיות", en: "calculation or algebra error despite a suitable approach" },
  { code: "D-W2", phase: "math_work", he: "קושי בבחירת נוסחה מתאימה", en: "chooses an unsuitable formula" },
  { code: "D-W3", phase: "math_work", he: "קושי בבחירת אסטרטגיית פתרון", en: "unsuitable algorithm or order of steps" },
  { code: "D-W4", phase: "math_work", he: "קושי בשימוש בטכנולוגיה לעבודה מתמטית", en: "struggles with a digital tool for calculation" },
  { code: "D-W5", phase: "math_work", he: "קושי בהבנה מושגית (עבודה מתמטית)", en: "misunderstands a concept needed while solving" },
  { code: "D-W6", phase: "math_work", he: "קושי בשל מורכבות המודל", en: "loses track of a multi-step solution" },
  { code: "D-W7", phase: "math_work", he: "קושי בהמרת יחידות", en: "cannot convert units or mixes units" },
  { code: "D-I1", phase: "interpreting", he: "קושי בזיהוי משמעות התוצאות", en: "gives a number without real meaning; wrong real meaning" },
  { code: "D-I2", phase: "interpreting", he: "קושי במתן תשובה לשאלה", en: "finished the maths but does not answer the original question" },
  { code: "D-V1", phase: "validating", he: "קושי בבחינת התאמת התוצאות למציאות", en: "accepts an unreasonable result without checking" },
  { code: "D-V2", phase: "validating", he: "קושי בזיהוי השפעת אילוצים והנחות", en: "ignores how assumptions or real conditions affect the result" },
  { code: "D-V3", phase: "validating", he: "קושי בזיהוי אפשרויות לשיפור", en: "knows the model is lacking but not what to change" },
  { code: "D-V4", phase: "validating", he: "קושי בתיקוף מקיף", en: "checks only the arithmetic, not assumptions or constraints" },
  { code: "D-V5", phase: "validating", he: "קושי בשיפור המודל בפועל", en: "identifies a needed change but cannot implement it" },
];

// Cross-cutting skills (מיומנויות רוחב), visible throughout the process.
export const TRANSVERSAL: { code: string; he: string; en: string }[] = [
  { code: "X-PLAN", he: "תכנון", en: "sets sub-goals and chooses a course of action" },
  { code: "X-MONITOR", he: "ניטור", en: "tracks progress and notices difficulties" },
  { code: "X-EVAL", he: "הערכה", en: "evaluates the process, decisions and products" },
  { code: "X-REGULATE", he: "ויסות והתאמה", en: "changes strategy after a difficulty or new information" },
  { code: "X-REASON", he: "הנמקה", en: "explains and justifies decisions and conclusions" },
  { code: "X-CRITICAL", he: "חשיבה ביקורתית", en: "questions assumptions, claims, alternatives, limits" },
  { code: "X-FLEX", he: "גמישות", en: "switches representations, strategies or models" },
  { code: "X-DECIDE", he: "קבלת החלטות", en: "makes a reasoned choice between options" },
];

// Distinctions the lab asks coders to keep in mind.
export const DIAGNOSTIC_NOTES = [
  "D-U5 is not simply starting to calculate early; it applies when the calculation is not grounded in understanding the situation.",
  "In simplifying, identifying variables refers to their real-world meaning; defining symbols, units and quantitative relations belongs to mathematising.",
  "D-M3 = knows the maths but cannot choose a representation; D-M5 = conceptual misunderstanding; D-M6 = missing mathematical knowledge.",
  "D-W1 (executing a calculation) is different from D-W3 (choosing a strategy or algorithm).",
  "Interpreting = explaining what a result means; validating = judging whether the result and model fit reality.",
  "D-V3 = recognising what could be improved; D-V5 = actually carrying out the improvement.",
];

const ALL = new Map<string, string>([
  ...SKILLS.map((s) => [s.code, s.he] as [string, string]),
  ...DIFFICULTIES.map((d) => [d.code, d.he] as [string, string]),
  ...TRANSVERSAL.map((t) => [t.code, t.he] as [string, string]),
]);

export function codeLabel(code: string): string {
  return ALL.get(code) ?? code;
}

export function codeLabels(): Record<string, string> {
  return Object.fromEntries(ALL);
}
