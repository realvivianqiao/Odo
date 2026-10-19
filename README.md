# Odo

Say your dream out loud. Odo writes it into a short story, paints each scene in one consistent
illustrated style, plays it back as a dreamscape, and gives you a reading.

Live at **https://odo3.vercel.app**

## What's where

| Path | What it is | How it goes live |
| --- | --- | --- |
| `index.html`, `privacy.html`, `support.html`, `sw.js`, `manifest.webmanifest`, `icons/`, `vercel.json` | The whole app (one self-contained page) | Vercel deploys it on every push to `main` |
| `supabase/functions/` | Server functions: `storyboard` (writes the dream), `interpret` (the reading), `illustrate` (paints the scenes), `delete-account` | Deployed to the Supabase project **odo** (see below) |
| `supabase/migrations/` | Database changes | Applied to the Supabase project |
| `ios/` | The iPhone app (Capacitor). It wraps the same `index.html` | Built in Xcode, see `ios/README.md` |

## How it works

- **Writing the dream:** `storyboard` turns the raw transcript into a title, a retold story, a cast
  description and up to 10 scenes. Model: OpenAI `gpt-5.6-sol`, reasoning effort medium
  (`ODO_TEXT_MODEL` secret overrides it), with Claude as a fallback.
- **Reading:** `interpret`, same model.
- **Pictures:** `illustrate` paints one image per scene (max 10) with `gpt-image-2.5-flare` in
  the house style, stores them privately in the `dreamscapes` bucket and records them in `dream_frames`.
- **Long calls:** writing and reading take about a minute. The functions answer immediately and send a
  keep-alive space every 5 seconds, and they file each finished result in `dream_results`. If the
  phone drops the connection (app switched away, screen locked), the app collects the result from there.
- **How you appear:** Profile → *In your dreams* (woman / man / open, plus an optional description).
  Saved on the account and added to every picture prompt.

## Secrets (Supabase → Edge Functions → Secrets)

`OPENAI_API_KEY` (required), `ANTHROPIC_API_KEY` (fallback). Optional: `ODO_TEXT_MODEL`,
`ODO_IMAGE_MODEL`, `ODO_IMAGE_QUALITY`, `ODO_DAILY_LIMIT` (default 15 per day; accounts in
`odo_unlimited` have no limit). Never put keys in this repo.

## Deploying

**The app:** connect this repo to the Vercel project `odo3` once (Vercel → odo3 → Settings → Git →
Connect Git Repository → `realvivianqiao/Odo`, production branch `main`). After that every push to
`main` goes live. `.vercelignore` keeps `ios/` and `supabase/` off the website.

**Server functions** (only when something in `supabase/functions/` changes):

    npx supabase login
    npx supabase functions deploy storyboard  --project-ref bkysyonvjyyqwifjneuh
    npx supabase functions deploy interpret   --project-ref bkysyonvjyyqwifjneuh
    npx supabase functions deploy illustrate  --project-ref bkysyonvjyyqwifjneuh

## Supabase project

Project **odo** (`bkysyonvjyyqwifjneuh`). Tables: `profiles`, `dreams`, `dream_frames`,
`dream_results`, `usage`, `odo_unlimited`. Every table has row-level security so people only see their own rows.
