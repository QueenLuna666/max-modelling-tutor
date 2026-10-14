// Browser helpers for the studio: shrink a photo before upload, and read a streamed (NDJSON) reply.
"use client";

export type UploadImage = { data: string; mediaType: "image/jpeg"; preview: string };

// Phone photos are 3–10 MB; the agent needs ~1500px. Resize and re-encode as JPEG.
export async function shrinkImage(file: File, maxSide = 1568): Promise<UploadImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("לא הצלחתי לקרוא את התמונה"));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const preview = canvas.toDataURL("image/jpeg", 0.85);
    return { data: preview.split(",")[1], mediaType: "image/jpeg", preview };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// POST JSON, read the JSON-lines stream, call onEvent for each line; returns the last line.
export async function postStream<T = Record<string, unknown>>(
  url: string,
  body: unknown,
  onEvent: (ev: T) => void,
): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as { error?: string }).error ?? `שגיאה (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let last: T | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const ev = JSON.parse(line) as T;
      last = ev;
      onEvent(ev);
    }
  }
  if (!last) throw new Error("לא התקבלה תשובה מהשרת");
  const err = (last as { error?: string }).error;
  if (err) throw new Error(err);
  return last;
}
