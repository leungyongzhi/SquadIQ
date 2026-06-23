-- Football App Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Players table
create table if not exists public.players (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  name text not null,
  rating int not null default 3 check (rating between 1 and 6),
  position_bias int not null default 3 check (position_bias between 1 and 5),
  is_goalkeeper boolean not null default false,
  gk_rating int check (gk_rating between 1 and 6),
  outfield_rating int check (outfield_rating between 1 and 6),
  is_active boolean not null default true,
  user_id uuid references auth.users(id) on delete set null,
  avatar_url text,
  intended_role text check (intended_role in ('admin', 'player')) default 'player'
);

-- Match events table
create table if not exists public.match_events (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  title text not null,
  event_date date not null,
  event_time time not null default '19:00',
  location text,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed')),
  team_blue_ids uuid[] not null default '{}',
  team_orange_ids uuid[] not null default '{}',
  gk_blue_id uuid references public.players(id) on delete set null,
  gk_orange_id uuid references public.players(id) on delete set null,
  score_blue int not null default 0,
  score_orange int not null default 0,
  payment_link text,
  payment_message text,
  player_of_match_id uuid references public.players(id) on delete set null,
  voting_open boolean not null default false
);

-- Event enrollments table
create table if not exists public.event_enrollments (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  event_id uuid not null references public.match_events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  form text not null default 'neutral' check (form in ('hot', 'neutral', 'cold')),
  has_paid boolean not null default false,
  unique (event_id, player_id)
);

-- Goals table
create table if not exists public.goals (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  event_id uuid not null references public.match_events(id) on delete cascade,
  scorer_id uuid not null references public.players(id) on delete cascade,
  assister_id uuid references public.players(id) on delete set null,
  team text not null check (team in ('blue', 'orange')),
  minute int
);

-- POTM votes table
create table if not exists public.potm_votes (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  event_id uuid not null references public.match_events(id) on delete cascade,
  voter_id uuid not null references public.players(id) on delete cascade,
  nominee_id uuid not null references public.players(id) on delete cascade,
  unique (event_id, voter_id)
);

-- User profiles table (extends auth.users)
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  full_name text,
  role text not null default 'player' check (role in ('admin', 'player')),
  player_id uuid references public.players(id) on delete set null
);

-- RLS Policies
alter table public.players enable row level security;
alter table public.match_events enable row level security;
alter table public.event_enrollments enable row level security;
alter table public.goals enable row level security;
alter table public.potm_votes enable row level security;
alter table public.user_profiles enable row level security;

-- Helper function to check admin role
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Players: everyone can read active players, only admins can write
create policy "players_read" on public.players for select using (true);
create policy "players_write" on public.players for all using (public.is_admin());

-- Match events: everyone authenticated can read, only admins write
create policy "events_read" on public.match_events for select using (auth.uid() is not null);
create policy "events_write" on public.match_events for all using (public.is_admin());

-- Enrollments: players can read all, enroll themselves; admins can do anything
create policy "enrollments_read" on public.event_enrollments for select using (auth.uid() is not null);
create policy "enrollments_self_insert" on public.event_enrollments for insert
  with check (
    auth.uid() is not null and (
      public.is_admin() or
      player_id = (select player_id from public.user_profiles where id = auth.uid())
    )
  );
create policy "enrollments_self_delete" on public.event_enrollments for delete
  using (
    public.is_admin() or
    player_id = (select player_id from public.user_profiles where id = auth.uid())
  );
create policy "enrollments_admin_update" on public.event_enrollments for update
  using (public.is_admin());

-- Goals: read all authenticated, write admin only
create policy "goals_read" on public.goals for select using (auth.uid() is not null);
create policy "goals_write" on public.goals for all using (public.is_admin());

-- POTM votes: players vote, read own votes; admins read all
create policy "potm_read_own" on public.potm_votes for select using (
  public.is_admin() or voter_id = (select player_id from public.user_profiles where id = auth.uid())
);
create policy "potm_insert" on public.potm_votes for insert
  with check (
    voter_id = (select player_id from public.user_profiles where id = auth.uid()) and
    nominee_id != voter_id
  );

-- User profiles: users read their own, admins read all
create policy "profiles_read_own" on public.user_profiles for select using (
  id = auth.uid() or public.is_admin()
);
create policy "profiles_insert" on public.user_profiles for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.user_profiles for update using (id = auth.uid());
create policy "profiles_admin_update" on public.user_profiles for update using (public.is_admin());

-- Trigger: auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'intended_role', 'player')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Seed data: all 66 players
insert into public.players (name, rating, position_bias, is_goalkeeper, gk_rating) values
  ('Andrea', 3, 4, false, null),
  ('Andrew', 2, 2, false, null),
  ('Ayaan', 4, 2, false, null),
  ('Ben Park', 4, 2, false, null),
  ('Bilal', 3, 4, false, null),
  ('Bilal Friend', 3, 4, false, null),
  ('Chris', 3, 2, false, null),
  ('Matthew', 4, 2, false, null),
  ('Dionne', 2, 4, false, null),
  ('Eros', 4, 4, false, null),
  ('George', 3, 2, false, null),
  ('Glen', 3, 2, false, null),
  ('Hasan', 2, 4, false, null),
  ('Ilias', 3, 2, false, null),
  ('Ini', 5, 3, true, 5),
  ('James', 2, 2, false, null),
  ('Jeymar', 5, 4, false, null),
  ('Jo', 4, 4, false, null),
  ('Joe', 4, 2, false, null),
  ('Johnson', 4, 4, false, null),
  ('Josh', 3, 4, false, null),
  ('Junior', 5, 4, false, null),
  ('Justin', 5, 2, false, null),
  ('Kal', 3, 3, true, 3),
  ('Kat', 2, 4, false, null),
  ('Kevin', 5, 4, false, null),
  ('Kirk', 5, 2, false, null),
  ('Kole', 3, 2, false, null),
  ('Konrad', 5, 2, false, null),
  ('Kristina', 4, 4, false, null),
  ('Leroy', 6, 4, false, null),
  ('Liam 043', 4, 2, false, null),
  ('Luke', 4, 4, false, null),
  ('Luke Wheeler', 5, 2, false, null),
  ('Matt Horan', 4, 4, false, null),
  ('Michael', 4, 2, false, null),
  ('Nazir', 2, 4, false, null),
  ('Nish', 3, 4, false, null),
  ('Nit', 3, 4, false, null),
  ('Oscar', 3, 4, false, null),
  ('Paul', 2, 2, false, null),
  ('Rich', 3, 2, false, null),
  ('Rita', 5, 4, false, null),
  ('Rob', 3, 4, false, null),
  ('Rob K', 4, 4, false, null),
  ('Romeo', 5, 4, false, null),
  ('Rui', 5, 4, false, null),
  ('Saihaan', 3, 4, false, null),
  ('Sam', 4, 3, true, 4),
  ('Sarwar', 4, 2, false, null),
  ('Sass', 4, 2, false, null),
  ('Sergio', 3, 2, false, null),
  ('Shannon', 3, 4, false, null),
  ('Shaun', 2, 4, false, null),
  ('Simon', 2, 2, false, null),
  ('Stephen G', 4, 2, false, null),
  ('Tayson', 5, 2, false, null),
  ('Teo', 5, 4, false, null),
  ('Terry', 3, 4, false, null),
  ('Thomas', 3, 2, false, null),
  ('Troy', 3, 2, false, null),
  ('Tylan', 3, 4, false, null),
  ('Waqas', 3, 4, false, null),
  ('Will', 3, 2, false, null),
  ('Yildiz', 3, 4, false, null),
  ('Zack', 3, 4, false, null)
on conflict do nothing;
