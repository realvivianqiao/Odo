-- Finished model results (storyboard, reading), filed by the server so the app can collect them
-- even if the phone dropped the connection while waiting.
create table if not exists public.dream_results (
  dream_id text not null,
  kind text not null check (kind in ('storyboard', 'reading')),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  via text,
  updated_at timestamptz not null default now(),
  primary key (dream_id, kind)
);
create index if not exists dream_results_user_idx on public.dream_results (user_id);
alter table public.dream_results enable row level security;
create policy "read own results" on public.dream_results for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.dream_results from anon, authenticated;
