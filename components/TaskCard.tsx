"use client";
// The task as it appears in the research team's task card: definition, labelled picture,
// two explanations, and the question in a highlighted box. Text supports **bold**.
import { useState } from "react";

export type CardData = {
  image: string | null;
  title?: string;
  definition?: string;
  image_alt?: string;
  points?: string[];
  question?: string;
};

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <span key={i} className="block">
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={j} className="font-semibold text-ink">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <span key={j}>{part}</span>
            ),
          )}
        </span>
      ))}
    </>
  );
}

export function TaskCard({ card, statement, fullImage }: { card: CardData | null; statement: string; fullImage?: string | null }) {
  const [imgOk, setImgOk] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);

  if (!card || !card.question) {
    return <p className="leading-relaxed whitespace-pre-wrap">{statement}</p>;
  }

  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {card.title && (
        <div className="inline-block rounded-md bg-sun px-3 py-1 text-base font-bold text-ink">{card.title}</div>
      )}
      {card.definition && (
        <div className="rounded-lg border-2 border-accent/40 bg-surface px-3 py-2 text-muted">
          <Rich text={card.definition} />
        </div>
      )}
      {card.image && imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.image}
          alt={card.image_alt ?? ""}
          onError={() => setImgOk(false)}
          className="mx-auto max-h-64 w-auto max-w-full rounded-lg"
        />
      )}
      {card.points?.map((p, i) => (
        <p key={i} className="flex gap-2 text-muted">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
          <span>
            <Rich text={p} />
          </span>
        </p>
      ))}
      <div className="rounded-lg bg-sun px-4 py-3 text-ink">
        <Rich text={card.question} />
      </div>
      {fullImage && (
        <div>
          <button type="button" onClick={() => setShowOriginal((v) => !v)} className="text-xs text-accent underline">
            {showOriginal ? "הסתר את כרטיס המשימה המקורי" : "הצג את כרטיס המשימה המקורי"}
          </button>
          {showOriginal && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fullImage} alt="" className="mt-2 w-full rounded-lg border border-line" />
          )}
        </div>
      )}
    </div>
  );
}
