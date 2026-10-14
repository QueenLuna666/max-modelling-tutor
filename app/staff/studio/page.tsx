"use client";
// Task studio: build a new modelling task from a photo and/or a short description, and see all tasks.
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StaffShell, useStaffData } from "@/components/StaffShell";
import { postStream, shrinkImage, type UploadImage } from "@/lib/clientMedia";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/studioUi";

type Row = { id: string; status: "draft" | "published" | "archived"; title: string; image: string | null; builtIn: boolean; updatedAt: string | null };

export default function StudioPage() {
  return <StaffShell crumbs={[{ label: "סטודיו משימות" }]}>{() => <Studio />}</StaffShell>;
}

const EXPECTED_CHARS = 22000; // typical size of a full task, for the progress bar

function Studio() {
  const router = useRouter();
  const { data, error } = useStaffData<{ tasks: Row[] }>("/api/studio");
  const [image, setImage] = useState<UploadImage | null>(null);
  const [description, setDescription] = useState("");
  const [grade, setGrade] = useState("");
  const [busy, setBusy] = useState<null | { stage: string; pct: number }>(null);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      setImage(await shrinkImage(f));
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function build() {
    if (!image && !description.trim()) {
      setMsg("צלמו או העלו תמונה, או כתבו תיאור קצר");
      return;
    }
    setMsg("");
    setBusy({ stage: "מתחיל…", pct: 2 });
    try {
      const last = await postStream<{ stage?: string; progress?: number; id?: string }>(
        "/api/studio",
        { image: image ? { data: image.data, mediaType: image.mediaType } : null, description, grade },
        (ev) => {
          if (ev.stage === "upload") setBusy({ stage: "מעלה את התמונה…", pct: 4 });
          if (ev.stage === "write") setBusy({ stage: "הסוכן מסתכל על התמונה ומתכנן משימה…", pct: 8 });
          if (ev.progress) setBusy({ stage: "כותב את המשימה: כרטיס בשלוש שפות, שישה שלבים, רמזים ופתרון ייחוס…", pct: Math.min(96, 10 + (ev.progress / EXPECTED_CHARS) * 86) });
        },
      );
      if (last.id) router.push(`/staff/studio/${last.id}`);
    } catch (err) {
      setMsg((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      <section className="h-fit rounded-2xl border border-line bg-surface p-5">
        <h1 className="text-xl font-bold">משימה חדשה</h1>
        <p className="mt-1 text-sm text-muted">
          צלמו משהו מהעולם (ברז, חניה, מדף בסופר, שלט…) או תארו מצב. הסוכן יבנה משימת מידול פתוחה לפי מסגרת המעבדה, ואתן מאשרות לפני שהיא מגיעה לתלמידים.
        </p>

        <input ref={fileRef} type="file" accept="image/*" onChange={pick} className="hidden" />
        {image ? (
          <div className="relative mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.preview} alt="התמונה שנבחרה" className="max-h-60 w-full rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => setImage(null)}
              className="absolute top-2 left-2 rounded-lg bg-surface/90 px-2 py-1 text-xs shadow"
            >
              הסירו
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-4 flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-accent/40 bg-accent-soft/40 px-4 py-6 text-accent hover:bg-accent-soft"
          >
            <span className="text-3xl" aria-hidden>📷</span>
            <span className="font-semibold">צלמו או העלו תמונה</span>
            <span className="text-xs text-muted">בטלפון אפשר לצלם ישר מהמצלמה</span>
          </button>
        )}

        <label className="mt-4 block">
          <span className="text-sm font-medium">תיאור קצר {image ? "(לא חובה)" : ""}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="למשל: הברז בחצר בית הספר מטפטף כל הלילה. כמה מים הולכים לאיבוד בשנה?"
            className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-sm font-medium">שכבת גיל</span>
          <select value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm">
            <option value="">חטיבת ביניים (ז׳–ט׳)</option>
            <option value="grade 7">כיתה ז׳</option>
            <option value="grade 8">כיתה ח׳</option>
            <option value="grade 9">כיתה ט׳</option>
          </select>
        </label>

        {busy ? (
          <div className="mt-5" role="status">
            <div className="h-2 overflow-hidden rounded-full bg-paper">
              <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${busy.pct}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted">{busy.stage}</p>
            <p className="text-xs text-muted">בדרך כלל לוקח כדקה–שתיים.</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={build}
            className="mt-5 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white hover:bg-accent-strong"
          >
            ✨ בנו לי משימה
          </button>
        )}
        {msg && <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{msg}</p>}
      </section>

      <section>
        <h2 className="mb-1 text-xl font-bold">כל המשימות</h2>
        <p className="mb-4 text-sm text-muted">טיוטות רואות רק אתן. משימה שפורסמה מופיעה לתלמידים (אפשר לבחור לכל כיתה אילו משימות פתוחות בה).</p>
        {error && <p className="text-warn">{error}</p>}
        {!data ? (
          <p className="text-muted">טוען…</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.tasks.map((t) => (
              <li key={t.id}>
                <Link href={`/staff/studio/${t.id}`} className="block h-full overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-accent hover:shadow-sm">
                  {t.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.image} alt="" className="h-32 w-full bg-paper object-contain" />
                  ) : (
                    <div className="flex h-32 items-center justify-center bg-accent-soft text-4xl" aria-hidden>
                      📐
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold">{t.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      <span className={`rounded-md px-2 py-0.5 ${STATUS_STYLE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                      {t.builtIn && <span className="rounded-md bg-info-soft px-2 py-0.5 text-info">משימת המעבדה</span>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
