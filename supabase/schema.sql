-- ============================================
-- Couples Hub — Supabase Schema
-- Run this in your Supabase SQL editor
-- ============================================

create extension if not exists "uuid-ossp";

-- ─── PROFILES ─────────────────────────────
create table public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  name       text not null,
  avatar_url text,
  created_at timestamptz default now()
);

-- ─── HOUSEHOLDS ───────────────────────────
create table public.households (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  invite_code text unique not null
    default upper(substring(replace(uuid_generate_v4()::text, '-', ''), 1, 8)),
  created_at  timestamptz default now()
);

-- ─── HOUSEHOLD MEMBERS ────────────────────
create table public.household_members (
  household_id uuid references public.households(id) on delete cascade,
  user_id      uuid references public.profiles(id)   on delete cascade,
  role         text not null default 'member' check (role in ('owner','member')),
  joined_at    timestamptz default now(),
  primary key (household_id, user_id)
);

-- ─── CALENDAR EVENTS ──────────────────────
create table public.calendar_events (
  id           uuid default uuid_generate_v4() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  created_by   uuid references public.profiles(id)   not null,
  title        text not null,
  description  text,
  start_time   timestamptz not null,
  end_time     timestamptz not null,
  all_day      boolean default false,
  color        text default '#7C3AED',
  created_at   timestamptz default now()
);

-- ─── SHOPPING LISTS ───────────────────────
create table public.shopping_lists (
  id           uuid default uuid_generate_v4() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  name         text not null,
  created_by   uuid references public.profiles(id) not null,
  created_at   timestamptz default now()
);

-- ─── SHOPPING ITEMS ───────────────────────
create table public.shopping_items (
  id         uuid default uuid_generate_v4() primary key,
  list_id    uuid references public.shopping_lists(id) on delete cascade not null,
  name       text not null,
  quantity   text,
  checked    boolean default false,
  added_by   uuid references public.profiles(id),
  checked_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- ─── BUDGET CATEGORIES ────────────────────
create table public.budget_categories (
  id            uuid default uuid_generate_v4() primary key,
  household_id  uuid references public.households(id) on delete cascade not null,
  name          text not null,
  monthly_limit decimal(10,2) not null default 0,
  icon          text default '📦',
  color         text default '#7C3AED'
);

-- ─── EXPENSES ─────────────────────────────
create table public.expenses (
  id           uuid default uuid_generate_v4() primary key,
  household_id uuid references public.households(id)    on delete cascade not null,
  paid_by      uuid references public.profiles(id)      not null,
  category_id  uuid references public.budget_categories(id),
  amount       decimal(10,2) not null,
  description  text not null,
  date         date not null default current_date,
  created_at   timestamptz default now()
);

-- ─── SAVINGS GOALS ────────────────────────
create table public.savings_goals (
  id             uuid default uuid_generate_v4() primary key,
  household_id   uuid references public.households(id) on delete cascade not null,
  name           text not null,
  target_amount  decimal(10,2) not null,
  current_amount decimal(10,2) not null default 0,
  deadline       date,
  icon           text default '🎯',
  created_at     timestamptz default now()
);

-- ─── SUBSCRIPTIONS ────────────────────────
create table public.subscriptions (
  id                uuid default uuid_generate_v4() primary key,
  household_id      uuid references public.households(id) on delete cascade not null,
  name              text not null,
  amount            decimal(10,2) not null,
  billing_cycle     text not null default 'monthly'
    check (billing_cycle in ('monthly','yearly','weekly')),
  next_billing_date date,
  icon              text default '📦',
  created_at        timestamptz default now()
);

-- ─── PANTRY ITEMS ─────────────────────────
create table public.pantry_items (
  id           uuid default uuid_generate_v4() primary key,
  household_id uuid references public.households(id) on delete cascade not null,
  name         text not null,
  quantity     text,
  expires_at   date,
  created_at   timestamptz default now()
);

-- ═══════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════

alter table public.profiles          enable row level security;
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.calendar_events   enable row level security;
alter table public.shopping_lists    enable row level security;
alter table public.shopping_items    enable row level security;
alter table public.budget_categories enable row level security;
alter table public.expenses          enable row level security;
alter table public.savings_goals     enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.pantry_items      enable row level security;

-- Helper: get the current user's household id
create or replace function public.get_my_household_id()
returns uuid language sql security definer as $$
  select household_id from public.household_members
  where user_id = auth.uid() limit 1;
$$;

-- PROFILES
create policy "Anyone can view profiles"
  on public.profiles for select using (true);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- HOUSEHOLDS
create policy "Members can view their household"
  on public.households for select using (id = public.get_my_household_id());
create policy "Authenticated users can create households"
  on public.households for insert with check (auth.uid() is not null);
create policy "Members can update their household"
  on public.households for update using (id = public.get_my_household_id());

-- HOUSEHOLD MEMBERS
create policy "Members can view membership"
  on public.household_members for select using (household_id = public.get_my_household_id());
create policy "Users can join households"
  on public.household_members for insert with check (user_id = auth.uid());
create policy "Users can leave households"
  on public.household_members for delete using (user_id = auth.uid());

-- CALENDAR EVENTS
create policy "Household members can manage events"
  on public.calendar_events for all
  using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- SHOPPING LISTS
create policy "Household members can manage lists"
  on public.shopping_lists for all
  using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- SHOPPING ITEMS (scoped via list → household)
create policy "Household members can manage items"
  on public.shopping_items for all
  using (list_id in (
    select id from public.shopping_lists
    where household_id = public.get_my_household_id()
  ))
  with check (list_id in (
    select id from public.shopping_lists
    where household_id = public.get_my_household_id()
  ));

-- BUDGET CATEGORIES
create policy "Household members can manage categories"
  on public.budget_categories for all
  using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- EXPENSES
create policy "Household members can manage expenses"
  on public.expenses for all
  using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- SAVINGS GOALS
create policy "Household members can manage goals"
  on public.savings_goals for all
  using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- SUBSCRIPTIONS
create policy "Household members can manage subscriptions"
  on public.subscriptions for all
  using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- PANTRY
create policy "Household members can manage pantry"
  on public.pantry_items for all
  using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- ═══════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════
-- REALTIME
-- ═══════════════════════════════════════════

alter publication supabase_realtime add table public.shopping_items;
alter publication supabase_realtime add table public.shopping_lists;
alter publication supabase_realtime add table public.calendar_events;
alter publication supabase_realtime add table public.expenses;
