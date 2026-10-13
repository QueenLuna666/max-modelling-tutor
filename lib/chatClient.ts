// Browser helpers for the student screen (track B). Safe to import in client components.

export type StartResult = {
  sessionId: string;
  opening: string;
  task: {
    id: string;
    title: string;
    statement: string;
    image: string | null;
    phases: { id: string; label: string }[];
  };
};

export async function startSession(input: {
  classCode: string;
  nickname: string;
  gender: "male" | "female";
  taskId?: string;
  lang?: "he" | "ar" | "en";
}): Promise<StartResult> {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "הכניסה נכשלה");
  return data;
}

// Sends one message and calls onText with the growing reply as it streams in.
// Returns the full reply and the session's current phase id.
export async function sendMessage(
  sessionId: string,
  content: string,
  responseMs: number | null,
  onText: (soFar: string) => void,
): Promise<{ reply: string; phase: string | null }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, content, responseMs }),
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "השליחה נכשלה");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let reply = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    reply += decoder.decode(value, { stream: true });
    onText(reply);
  }
  return { reply, phase: res.headers.get("X-Phase") };
}
