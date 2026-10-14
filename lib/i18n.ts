"use client";
import { useMemo, useSyncExternalStore } from "react";

// Student-facing UI text in Hebrew and Arabic. Entries with { male, female } follow the student's choice.
export type UiLang = "he" | "ar";
export type UiGender = "male" | "female";

type Text = string | { male: string; female: string };

const STRINGS = {
  appName: { he: "MAX — מודלים מתמטיים", ar: "MAX — النمذجة الرياضيّة" },
  studentLogin: { he: "כניסת תלמידים", ar: "دخول الطلاب" },
  classCode: { he: "קוד כיתה", ar: "رمز الصف" },
  classCodeHint: { he: "המורה ייתן לכם את הקוד", ar: "المعلّم سيعطيكم الرمز" },
  nickname: { he: "שם", ar: "الاسم" },
  nicknameHint: {
    he: "שם פרטי בלבד, בלי שם משפחה",
    ar: "الاسم الأول فقط، بدون اسم العائلة",
  },
  firstName: { he: "שם פרטי", ar: "الاسم الشخصي" },
  lastName: { he: "שם משפחה", ar: "اسم العائلة" },
  phone: { he: "מספר טלפון", ar: "رقم الهاتف" },
  phoneHint: {
    he: "כך נזהה אותך גם בפעם הבאה. המספר משמש רק לזיהוי ולא מוצג לתלמידים אחרים.",
    ar: "هكذا نتعرّف عليك في المرة القادمة أيضًا. الرقم يُستخدم للتعريف فقط ولا يُعرض للطلاب الآخرين.",
  },
  badPhone: { he: "מספר הטלפון לא נראה תקין (למשל 0521234567)", ar: "رقم الهاتف لا يبدو صحيحًا (مثلًا 0521234567)" },
  addressAs: { he: "איך לפנות אליך?", ar: "كيف نخاطبك؟" },
  boy: { he: "בן", ar: "ولد" },
  girl: { he: "בת", ar: "بنت" },
  language: { he: "שפה", ar: "اللغة" },
  enter: { he: "כניסה", ar: "دخول" },
  missingFields: {
    he: "צריך למלא קוד כיתה, שם פרטי, שם משפחה, טלפון, ולבחור איך לפנות אליך",
    ar: "يجب تعبئة رمز الصف والاسم الشخصي واسم العائلة والهاتف واختيار طريقة المخاطبة",
  },
  tasksTitle: { he: "המשימות שלי", ar: "مهامّي" },
  tasksIntro: {
    he: { male: "בחר משימה. MAX יעזור לך לחשוב, אבל לא יפתור במקומך.", female: "בחרי משימה. MAX יעזור לך לחשוב, אבל לא יפתור במקומך." },
    ar: { male: "اختر مهمة. MAX سيساعدك على التفكير، لكنه لن يحلّ بدلًا منك.", female: "اختاري مهمة. MAX سيساعدكِ على التفكير، لكنه لن يحلّ بدلًا منكِ." },
  },
  start: { he: "להתחיל", ar: "ابدأ" },
  logout: { he: "יציאה", ar: "خروج" },
  showTask: { he: "הראה שוב את המשימה", ar: "اعرض المهمة مرة أخرى" },
  close: { he: "סגירה", ar: "إغلاق" },
  finish: { he: "סיימתי", ar: "أنهيت" },
  finishConfirm: {
    he: { male: "לסיים את המשימה? לא תוכל להמשיך לכתוב בה.", female: "לסיים את המשימה? לא תוכלי להמשיך לכתוב בה." },
    ar: { male: "هل تريد إنهاء المهمة؟ لن تستطيع متابعة الكتابة فيها.", female: "هل تريدين إنهاء المهمة؟ لن تستطيعي متابعة الكتابة فيها." },
  },
  yesFinish: { he: "כן, לסיים", ar: "نعم، إنهاء" },
  keepWorking: { he: "להמשיך לעבוד", ar: "متابعة العمل" },
  finished: {
    he: { male: "כל הכבוד על העבודה! המשימה נשמרה.", female: "כל הכבוד על העבודה! המשימה נשמרה." },
    ar: { male: "أحسنت! تم حفظ المهمة.", female: "أحسنتِ! تم حفظ المهمة." },
  },
  backToTasks: { he: "חזרה למשימות", ar: "العودة إلى المهام" },
  placeholder: {
    he: { male: "כתוב כאן איך אתה חושב…", female: "כתבי כאן איך את חושבת…" },
    ar: { male: "اكتب هنا كيف تفكّر…", female: "اكتبي هنا كيف تفكّرين…" },
  },
  send: { he: "שליחה", ar: "إرسال" },
  enterHint: { he: "Enter לשליחה · Shift+Enter לשורה חדשה", ar: "Enter للإرسال · Shift+Enter لسطر جديد" },
  thinking: { he: "MAX חושב…", ar: "MAX يفكّر…" },
  // While the analyzer codes the message and MAX prepares its reply (a few seconds).
  reading: { he: "MAX קורא את מה שכתבת…", ar: "MAX يقرأ ما كتبته…" },
  pondering: { he: "MAX חושב איך לעזור לך להמשיך…", ar: "MAX يفكّر كيف يساعدك على المتابعة…" },
  almost: { he: "עוד רגע…", ar: "لحظة واحدة…" },
  stepsTitle: { he: "שלבי המידול", ar: "مراحل النمذجة" },
  loading: { he: "טוען…", ar: "جارٍ التحميل…" },
  error: { he: "משהו השתבש. נסו שוב.", ar: "حدث خطأ. حاولوا مرة أخرى." },
  you: { he: "אני", ar: "أنا" },
  // accessibility toolbar
  readTask: { he: "הקראת המשימה", ar: "قراءة المهمة بصوت" },
  readAloud: { he: "הקראה", ar: "قراءة بصوت" },
  stopReading: { he: "עצירה", ar: "إيقاف" },
  autoRead: { he: "הקראה אוטומטית של MAX", ar: "قراءة ردود MAX تلقائيًا" },
  speak: { he: "לדבר במקום להקליד", ar: "تكلّم بدل الكتابة" },
  listening: { he: "מקשיב… דברו עכשיו", ar: "أستمع… تكلّموا الآن" },
  simpler: { he: "🤔 תסביר לי פשוט יותר", ar: "🤔 اشرح لي بشكل أبسط" },
  simplerMsg: {
    he: "לא כל כך הבנתי. אפשר להסביר לי במילים פשוטות וקצרות יותר?",
    ar: "لم أفهم جيدًا. هل يمكنك أن تشرح لي بكلمات أبسط وأقصر؟",
  },
  finishDone: { he: "✅ סיימתי, תודה!", ar: "✅ أنهيت، شكرًا!" },
  challengeMe: { he: "🚀 כן, תאתגר אותי!", ar: "🚀 نعم، تحدَّني!" },
  finishDoneMsg: { he: "סיימתי, תודה!", ar: "أنهيت، شكرًا!" },
  challengeMeMsg: { he: "כן, אני רוצה אתגר!", ar: "نعم، أريد تحدّيًا!" },
  picture: { he: "🖼️ תראה לי בציור", ar: "🖼️ أرني بالرسم" },
  pictureMsg: {
    he: "אפשר להסביר לי את זה בעזרת ציור?",
    ar: "هل يمكنك أن تشرح لي ذلك بالرسم؟",
  },
  drawing: { he: "✏️ MAX מצייר…", ar: "✏️ MAX يرسم…" },
  bigger: { he: "הגדלת טקסט", ar: "تكبير النص" },
  smaller: { he: "הקטנת טקסט", ar: "تصغير النص" },
  readable: { he: "גופן מרווח וקריא", ar: "خط واضح ومتباعد" },
  noVoice: { he: "בדפדפן הזה אין קול בעברית. נסו בכרום או בטלפון.", ar: "لا يوجد صوت عربي في هذا المتصفح. جرّبوا Chrome أو الهاتف." },
  noMic: { he: "הדפדפן הזה לא תומך בהקלטת דיבור. נסו בכרום.", ar: "هذا المتصفح لا يدعم التعرّف على الكلام. جرّبوا Chrome." },
  tools: { he: "כלי עזר", ar: "أدوات مساعدة" },
  back: { he: "חזרה", ar: "رجوع" },
} satisfies Record<string, Record<UiLang, Text>>;

export type StringKey = keyof typeof STRINGS;

export function tr(key: StringKey, lang: UiLang, gender: UiGender = "male"): string {
  const v: Text = STRINGS[key][lang];
  return typeof v === "string" ? v : v[gender];
}

// The interface language chosen on the home page (remembered on this device).
export const LANG_KEY = "max_lang";

export function readUiLang(): UiLang {
  try {
    return localStorage.getItem(LANG_KEY) === "ar" ? "ar" : "he";
  } catch {
    return "he";
  }
}

export function saveUiLang(lang: UiLang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {}
}

// Saved in sessionStorage after login, read by the student pages.
// nickname = first name (what the pages show); firstName/lastName/phone identify the student.
export type StudentLogin = { classCode: string; nickname: string; firstName?: string; lastName?: string; phone?: string; gender: UiGender; lang: UiLang };
export const STUDENT_KEY = "max_student";

export function readStudent(): StudentLogin | null {
  try {
    const raw = sessionStorage.getItem(STUDENT_KEY);
    return raw ? (JSON.parse(raw) as StudentLogin) : null;
  } catch {
    return null;
  }
}

const noopSubscribe = () => () => {};
function readRaw(): string | null {
  try {
    return sessionStorage.getItem(STUDENT_KEY);
  } catch {
    return null;
  }
}

// The signed-in student (null on the server and when nobody is signed in).
export function useStudent(): StudentLogin | null {
  const raw = useSyncExternalStore(noopSubscribe, readRaw, () => null);
  return useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StudentLogin;
    } catch {
      return null;
    }
  }, [raw]);
}
