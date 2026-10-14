// A streamed response of JSON lines: progress while a long agent call runs, then the result.
// Keeps the connection alive and lets the page show progress.
export function ndjsonStream(work: (send: (obj: unknown) => void) => Promise<void>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      try {
        await work(send);
      } catch (e) {
        console.error(e);
        send({ error: e instanceof Error ? e.message : String(e) });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

// Throttled progress reporter.
export function progressSender(send: (obj: unknown) => void, everyMs = 1000) {
  let last = 0;
  return (chars: number) => {
    const now = Date.now();
    if (now - last >= everyMs) {
      last = now;
      send({ progress: chars });
    }
  };
}
