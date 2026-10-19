// Long model calls can take 60-90s. iPhone Safari drops a request that sits silent for about a minute,
// so answer right away and send a space every 5s until the JSON is ready (JSON.parse ignores leading spaces).
export function slowJson(cors: Record<string, string>, work: () => Promise<unknown>): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(c) {
      const send = (s: string) => { try { c.enqueue(enc.encode(s)); } catch (_) { /* client went away */ } };
      send(' ');
      const beat = setInterval(() => send(' '), 5000);
      let out: unknown;
      try { out = await work(); } catch (e) { console.error('slowJson', String(e)); out = { error: 'Something went wrong' }; }
      clearInterval(beat);
      send(JSON.stringify(out));
      try { c.close(); } catch (_) { /* already closed */ }
    },
  });
  return new Response(body, { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
