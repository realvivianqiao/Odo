// Builds www/ for the iPhone app from the web app at the repo root (the same files Vercel deploys).
// Usage: node build.mjs   (then: npx cap sync ios)
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, existsSync(join(here, 'web')) ? 'web' : existsSync(join(here, '../index.html')) ? '..' : '../odo');
const out = join(here, 'www');
rmSync(out, { recursive: true, force: true }); mkdirSync(join(out, 'vendor'), { recursive: true });
cpSync(join(web, 'icons'), join(out, 'icons'), { recursive: true });
cpSync(join(here, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'), join(out, 'vendor/supabase.js'));
await build({ entryPoints: [join(here, 'src/native.js')], bundle: true, format: 'iife', target: 'safari15', minify: true, outfile: join(out, 'native.js') });
let html = readFileSync(join(web, 'index.html'), 'utf8');
const swap = (a, b) => { if (!html.includes(a)) throw new Error('build: could not find ' + a); html = html.replace(a, b); };
swap('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js', 'vendor/supabase.js');
swap('<link rel="manifest" href="/manifest.webmanifest">', '<script src="native.js"></script>');
html = html.replaceAll('href="/icons/', 'href="icons/');
writeFileSync(join(out, 'index.html'), html);
console.log('www/ ready from', web);
