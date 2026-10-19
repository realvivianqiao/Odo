// Deletes the calling user's account. Their profile and dreams go with it (on delete cascade), and so do their dream images.
import { createClient } from 'npm:@supabase/supabase-js@2';

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
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Sign in first' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, adminKey(), { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) return json({ error: 'Sign in first' }, 401);
  const uid = data.user.id;
  try {
    const { data: dirs } = await admin.storage.from('dreamscapes').list(uid, { limit: 1000 });
    for (const d of dirs || []) {
      const { data: files } = await admin.storage.from('dreamscapes').list(`${uid}/${d.name}`, { limit: 1000 });
      if (files && files.length) await admin.storage.from('dreamscapes').remove(files.map((f) => `${uid}/${d.name}/${f.name}`));
    }
  } catch (e) { console.error('image cleanup', String(e)); }
  const del = await admin.auth.admin.deleteUser(uid);
  if (del.error) return json({ error: 'Could not delete the account' }, 500);
  return json({ deleted: true });
});
