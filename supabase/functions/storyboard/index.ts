// storyboard: signed-in odo users only (verify_jwt). Shares a daily allowance with the other odo functions.
// With a dreamId, the finished result is also filed in dream_results, so the app can collect it
// even if the phone dropped the connection (app switched away, screen locked) while waiting.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { generateText } from './llm.ts';
import { slowJson } from './stream.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function adminKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || ''; } catch (_) { return ''; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  let prompt = '', dreamId = '';
  try { const b = await req.json(); prompt = b.prompt; dreamId = String(b.dreamId || ''); } catch (_) { /* fall through */ }
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 30000) return json({ error: 'Send {"prompt": "..."} under 30,000 characters' }, 400);
  if (!/^[a-z0-9_-]{4,64}$/i.test(dreamId)) dreamId = '';
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
  const { data: credit, error: credErr } = await sb.rpc('take_daily_credit', { lim: Number(Deno.env.get('ODO_DAILY_LIMIT') || 15) });
  if (credErr || !credit) return json({ error: 'Could not check your daily limit' }, 500);
  if (!credit.ok) return json({ error: credit.reason || 'daily', limit: credit.limit }, 429);
  const uid = dreamId ? (await sb.auth.getUser()).data?.user?.id : undefined;
  return slowJson(cors, async () => {
    try {
      const { text, via } = await generateText(prompt, { effort: 'medium', maxOut: 12000 });
      if (dreamId && uid) {
        const admin = createClient(Deno.env.get('SUPABASE_URL')!, adminKey(), { auth: { persistSession: false } });
        const { data: prev } = await admin.from('dream_results').select('user_id').eq('dream_id', dreamId).eq('kind', 'storyboard').maybeSingle();
        const { error } = prev && prev.user_id !== uid ? { error: null } : await admin.from('dream_results').upsert({ dream_id: dreamId, kind: 'storyboard', user_id: uid, text, via, updated_at: new Date().toISOString() });
        if (error) console.error('dream_results', error.message);
      }
      return { text, via };
    } catch (e) {
      console.error('storyboard failed', String(e));
      try { await sb.rpc('refund_daily_credit'); } catch (_) { /* ignore */ }
      return { error: 'Could not reach the composer' };
    }
  });
});
