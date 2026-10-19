// illustrate: paints each scene of a dream with an image model (ODO_IMAGE_MODEL, default gpt-image-2.5-flare)
// and stores the frames privately at dreamscapes/<user id>/<dream id>/. Signed-in users only (verify_jwt).
// At most 10 pictures per dream (one per scene).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { slowJson } from './stream.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Odo's house style (owner-provided prompt). The scene description is appended after "Scene: ".
const STYLE = `Create a cinematic midcentury modern geometric editorial illustration.

Render the characters as elegant, elongated silhouettes with very slim angular bodies, long limbs, narrow shoulders, simplified geometric anatomy, tiny minimal facial features, and expressive posture. Build the image from crisp flat color planes and bold overlapping shapes rather than realistic shading or detailed linework.

Use a sophisticated 1950s–1960s editorial-poster visual language, combined with cinematic environmental storytelling. Compose the scene as a wide landscape frame with strong architectural geometry, generous negative space, and small human figures placed within a richly designed environment.

Lighting should be dramatic and graphic: cool blue ambient shadows, pale dawn or dusk light, and isolated warm pools of amber light. Cast long, sharply designed shadows across reflective surfaces. Use a restrained palette of midnight navy, slate blue, charcoal, warm ivory, muted rust, and one vivid red accent.

Add subtle screenprint and textured-paper grain, slightly weathered surfaces, and restrained imperfections. The finished image should feel sophisticated, intimate, melancholy, and literary—like a vintage editorial illustration directed as a cinematic film still.

Avoid photorealism, anime features, glossy 3D rendering, painterly brushwork, thick comic outlines, cute proportions, oversized eyes, heavily modeled faces, or generic fashion advertising. No text, caption, border, or watermark.

Scene: `;

function adminKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || ''; } catch (_) { return ''; }
}

async function paint(prompt: string, key: string): Promise<{ bytes?: Uint8Array; status: number; err?: string }> {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST', headers: { Authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ model: Deno.env.get('ODO_IMAGE_MODEL') || 'gpt-image-2.5-flare', prompt, size: '1536x1024', quality: Deno.env.get('ODO_IMAGE_QUALITY') || 'medium', output_format: 'jpeg', output_compression: 82 }),
  });
  const j = await r.json().catch(() => ({}));
  const b64 = j?.data?.[0]?.b64_json;
  if (!r.ok || !b64) return { status: r.status, err: j?.error?.code || j?.error?.message || 'no image' };
  return { status: 200, bytes: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return json({ error: 'OPENAI_API_KEY is not set' }, 500);
  let body: any = {};
  try { body = await req.json(); } catch (_) { /* fall through */ }
  const dreamId = String(body.dreamId || '');
  const sceneKey = String(body.key || '').slice(0, 64);
  const shots: string[] = Array.isArray(body.shots) ? body.shots.map((s: unknown) => String(s || '').slice(0, 1500)).slice(0, 10) : [];
  if (!/^[a-z0-9_-]{4,64}$/i.test(dreamId) || !shots.length || shots.some((s) => !s.trim())) return json({ error: 'Send {dreamId, shots: [..]}' }, 400);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
  const { data: u } = await sb.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return json({ error: 'Sign in first' }, 401);
  const { data: own } = await sb.from('dreams').select('id').eq('id', dreamId).maybeSingle();
  if (!own) return json({ error: 'Dream not found' }, 404);
  const { data: credit, error: credErr } = await sb.rpc('take_daily_credit', { lim: Number(Deno.env.get('ODO_DAILY_LIMIT') || 15) });
  if (credErr || !credit) return json({ error: 'Could not check your daily limit' }, 500);
  if (!credit.ok) return json({ error: credit.reason || 'daily', limit: credit.limit }, 429);

  return slowJson(cors, async () => {
    const prompts = shots.map((s) => `${STYLE}${s}`);
    // Paint five at a time so long dreams don't trip the image API's rate limits.
    const results: Array<{ bytes?: Uint8Array; status: number; err?: string }> = [];
    for (let k = 0; k < prompts.length; k += 5) results.push(...await Promise.all(prompts.slice(k, k + 5).map((p) => paint(p, key))));
    // One gentle retry, one at a time, for anything that hit a rate limit or a hiccup (not for content refusals).
    for (let i = 0; i < results.length; i++) {
      if (!results[i].bytes && results[i].status !== 400) { await new Promise((r) => setTimeout(r, 1500)); results[i] = await paint(prompts[i], key); }
    }
    results.forEach((r, i) => { if (!r.bytes) console.error('illustrate scene', i, r.status, r.err); });
    if (!results.some((r) => r.bytes)) { try { await sb.rpc('refund_daily_credit'); } catch (_) { /* ignore */ } return { error: 'Could not paint this dream' }; }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, adminKey(), { auth: { persistSession: false } });
    const folder = `${uid}/${dreamId}`;
    const { data: old } = await admin.storage.from('dreamscapes').list(folder, { limit: 100 });
    if (old && old.length) await admin.storage.from('dreamscapes').remove(old.map((f) => `${folder}/${f.name}`));
    const stamp = Date.now().toString(36);
    const paths = await Promise.all(results.map(async (r, i) => {
      if (!r.bytes) return null;
      const path = `${folder}/${stamp}-${i}.jpg`;
      const { error } = await admin.storage.from('dreamscapes').upload(path, r.bytes, { contentType: 'image/jpeg', upsert: true });
      if (error) { console.error('upload', i, error.message); return null; }
      return path;
    }));
    // Frames are recorded server-side in their own table, so later saves of the dream can't drop them.
    const { error: fErr } = await admin.from('dream_frames').upsert({ dream_id: dreamId, user_id: uid, key: sceneKey, paths, updated_at: new Date().toISOString() });
    if (fErr) console.error('dream_frames', fErr.message);
    return { paths, key: sceneKey };
  });
});
