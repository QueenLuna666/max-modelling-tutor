# MAX — AI tutor for mathematical modelling

אב-טיפוס שנבנה ב-Technion LabAI Challenge (אוקטובר 2026) עבור מעבדת MtED (פרופ' זהבית כהן).
MAX מלווה תלמידי חטיבת ביניים במשימות מידול מתמטי פתוחות: הוא לא פותר, אלא שואל ונותן רמזים מדורגים.
סוכן שני מאבחן כל הודעה של התלמיד (שלב מידול, ביצועים, מוטיבציה, סוג קושי), ומורות וחוקרות רואות את התהליך בדשבורד.

## מבנה

| | |
| --- | --- |
| `app/student/*` | כניסת תלמיד (קוד כיתה, כינוי, בן/בת, עברית/ערבית), ספריית משימות, מסך עבודה עם MAX |
| `app/staff/*` | כניסת צוות, כיתות, דשבורד כיתה (תלמיד × שלב, התראות), שיחה + מסע לכל תלמיד |
| `app/admin` | פתיחת חשבונות למורים ולחוקרות (מוגן ב-`ADMIN_SECRET`) |
| `app/api/chat` | תור של תלמיד: שמירה ← סוכן מאבחן ← בחירת רמז ← MAX בסטרימינג ← שמירה |
| `prompts/max_base.md` | ההוראות של MAX. החוקרות יכולות לערוך |
| `prompts/analyzer.md` | ההוראות של הסוכן המאבחן |
| `tasks/*.json` | משימות: נוסח, 7 שלבים, עדויות, טעויות נפוצות, 3 רמזים לכל שלב. משימה חדשה = קובץ + שורה ב-`lib/tasks.ts` |
| `lib/policy.ts` | טבלת ביצועים × מוטיבציה → רמת רמז |
| `lib/insights.ts` | המסע בין שלבים, חזרות, התראות. ספי ההתראות ב-`THRESHOLDS` |
| `supabase/schema.sql` | הטבלאות |

## הקמה

1. **Supabase** → SQL Editor → להדביק את `supabase/schema.sql` → Run.
2. **Vercel** → Add New → Project → לייבא את הריפו → Environment Variables:

   | משתנה | מאיפה |
   | --- | --- |
   | `AWS_BEARER_TOKEN_BEDROCK` | מפתח Bedrock של ההאקתון (הגישה ל-Claude דרך Amazon Bedrock) |
   | `AWS_REGION` | `us-east-1` |
   | `ANTHROPIC_API_KEY` | רק אם עובדים ישירות מול Anthropic במקום Bedrock |
   | `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (סודי) |
   | `AUTH_SECRET` | מחרוזת אקראית, לפחות 16 תווים |
   | `ADMIN_SECRET` | סיסמה לדף `/admin` |
   | `TUTOR_MODEL`, `ANALYZER_MODEL` | לא חובה. ברירת מחדל ב-Bedrock: `anthropic.claude-sonnet-5-5`, `anthropic.claude-haiku-5-5` |

   → Deploy.
3. בדיקה: `/api/health` מראה אם יש חיבור למסד הנתונים ול-Claude.
4. באתר החי: `/admin` → סיסמת המנהל → פותחים חשבונות לחוקרות ולמורים.
5. מורה נכנסת ב-`/staff/login` ופותחת כיתה, ומקבלת קוד לתלמידים. יש גם כיתת הדגמה מוכנה: `DEMO1`. היא לא משויכת למורה, ולכן רק חוקרות רואות אותה.
6. תמונת המשימה: `public/tasks/speedometer.png`.

## פיתוח מקומי

```bash
cp .env.example .env.local   # למלא את המפתחות
npm install
npm run dev
```

## פרטיות

תלמידים נכנסים עם כינוי בלבד, בלי שם ובלי מייל. כל הגישה לנתונים עוברת בשרת עם המפתח הסודי. כל הטבלאות מוגנות ב-RLS בלי מדיניות פתוחה, כך שאי אפשר לקרוא נתונים מהדפדפן.
