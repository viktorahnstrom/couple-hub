-- ============================================
-- Couples Hub — New tables migration
-- Paste this into your Supabase SQL Editor
-- and click "Run"
-- ============================================

-- ─── HOME STAPLES ────────────────────────
create table if not exists public.home_staples (
  id           uuid default uuid_generate_v4() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  added_by     uuid references public.profiles(id) not null,
  name         text not null,
  category     text not null default 'mat'
    check (category in ('mat', 'ovrigt')),
  status       text not null default 'ok'
    check (status in ('ok', 'low', 'out', 'bought')),
  created_at   timestamptz default now()
);

alter table public.home_staples enable row level security;

drop policy if exists "Household members can manage home staples" on public.home_staples;
create policy "Household members can manage home staples"
  on public.home_staples for all
  using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- ─── MONTHLY INCOME ───────────────────────
create table if not exists public.monthly_income (
  id           uuid default uuid_generate_v4() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  user_id      uuid references public.profiles(id) not null,
  label        text not null default 'Lön',
  amount       decimal(10,2) not null,
  created_at   timestamptz default now(),
  unique (household_id, user_id, label)
);

alter table public.monthly_income enable row level security;

drop policy if exists "Household members can view all incomes" on public.monthly_income;
drop policy if exists "Users can manage own income"            on public.monthly_income;
drop policy if exists "Users can update own income"            on public.monthly_income;
drop policy if exists "Users can delete own income"            on public.monthly_income;

create policy "Household members can view all incomes"
  on public.monthly_income for select
  using (household_id = public.get_my_household_id());

create policy "Users can manage own income"
  on public.monthly_income for insert
  with check (user_id = auth.uid() and household_id = public.get_my_household_id());

create policy "Users can update own income"
  on public.monthly_income for update
  using (user_id = auth.uid());

create policy "Users can delete own income"
  on public.monthly_income for delete
  using (user_id = auth.uid());

-- ─── WATCH TITLES ─────────────────────────
create table if not exists public.watch_titles (
  id              uuid default uuid_generate_v4() primary key,
  household_id    uuid references public.households(id) on delete cascade not null,
  added_by        uuid references public.profiles(id) not null,
  title           text not null,
  type            text not null check (type in ('series', 'program')),
  status          text not null default 'watching'
    check (status in ('watching', 'paused', 'finished')),
  current_season  int,
  current_episode int,
  created_at      timestamptz default now()
);

alter table public.watch_titles enable row level security;

drop policy if exists "Household members can manage watch titles" on public.watch_titles;
create policy "Household members can manage watch titles"
  on public.watch_titles for all
  using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- ─── WATCH RATINGS ────────────────────────
create table if not exists public.watch_ratings (
  id         uuid default uuid_generate_v4() primary key,
  title_id   uuid references public.watch_titles(id) on delete cascade not null,
  user_id    uuid references public.profiles(id) not null,
  rating     int not null check (rating between 1 and 5),
  created_at timestamptz default now(),
  unique (title_id, user_id)
);

alter table public.watch_ratings enable row level security;

drop policy if exists "Household members can view all ratings" on public.watch_ratings;
drop policy if exists "Users can manage own ratings"           on public.watch_ratings;
drop policy if exists "Users can update own ratings"           on public.watch_ratings;
drop policy if exists "Users can delete own ratings"           on public.watch_ratings;

create policy "Household members can view all ratings"
  on public.watch_ratings for select
  using (title_id in (
    select id from public.watch_titles
    where household_id = public.get_my_household_id()
  ));

create policy "Users can manage own ratings"
  on public.watch_ratings for insert
  with check (user_id = auth.uid());

create policy "Users can update own ratings"
  on public.watch_ratings for update
  using (user_id = auth.uid());

create policy "Users can delete own ratings"
  on public.watch_ratings for delete
  using (user_id = auth.uid());
