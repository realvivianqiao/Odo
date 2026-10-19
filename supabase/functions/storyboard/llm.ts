// Text generation: OpenAI first (ODO_TEXT_MODEL, default gpt-5.6-sol), Claude as a fallback if OpenAI fails.
export async function generateText(prompt: string, opts: { effort: string; maxOut: number }): Promise<{ text: string; via: string }> {
  const oKey = Deno.env.get('OPENAI_API_KEY');
  if (oKey) {
    try {
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + oKey, 'content-type': 'application/json' },
        body: JSON.stringify({ model: Deno.env.get('ODO_TEXT_MODEL') || 'gpt-5.6-sol', reasoning: { effort: opts.effort }, max_output_tokens: opts.maxOut, input: prompt }),
      });
      const j = await r.json();
      if (r.ok) {
        let text = typeof j.output_text === 'string' ? j.output_text : '';
        if (!text) text = (j.output || []).filter((o: any) => o.type === 'message').flatMap((o: any) => o.content || []).filter((c: any) => c.type === 'output_text').map((c: any) => c.text).join('');
        if (text) return { text, via: 'openai' };
        console.error('openai empty', j.status, JSON.stringify(j.incomplete_details || {}));
      } else console.error('openai error', r.status, JSON.stringify(j.error || j).slice(0, 400));
    } catch (e) { console.error('openai failed', String(e)); }
  }
  const aKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!aKey) throw new Error('no model available');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': aKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 8000, thinking: { type: 'between_tools' }, messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || 'upstream failed');
  const text = (j.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  if (!text) throw new Error('empty');
  return { text, via: 'anthropic' };
}
