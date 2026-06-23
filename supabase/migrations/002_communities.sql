-- Community Architecture Migration
-- Run this AFTER 001_football_schema.sql

-- Update user_profiles to support super_admin role
alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('super_admin', 'admin', 'player'));

-- Communities table
create table if not exists public.communities (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  name text not null,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  default_payment_link text,
  default_payment_amount numeric(10,2),
  default_payment_message text,
  is_active boolean not null default true
);

-- Community memberships (player ratings are per-community)
create table if not exists public.community_members (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  community_id uuid not null references public.communities(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  role text not null default 'player' check (role in ('admin', 'player')),
  rating int not null default 3 check (rating between 1 and 6),
  position_bias int not null default 3 check (position_bias between 1 and 5),
  is_goalkeeper boolean not null default false,
  gk_rating int check (gk_rating between 1 and 6),
  outfield_rating int check (outfield_rating between 1 and 6),
  unique (community_id, player_id)
);

-- Link match events to communities
alter table public.match_events
  add column if not exists community_id uuid references public.communities(id) on delete cascade;

-- RLS
alter table public.communities enable row level security;
alter table public.community_members enable row level security;

-- Helper: is user a super admin
create or replace function public.is_super_admin()
returns boolean as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$ language sql security definer stable;

-- Helper: is user admin of a specific community
create or replace function public.is_community_admin(community_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.community_members cm
    join public.user_profiles up on up.player_id = cm.player_id
    where cm.community_id = $1
    and up.id = auth.uid()
    and cm.role = 'admin'
  ) or public.is_super_admin();
$$ language sql security definer stable;

-- Helper: is user member of a community
create or replace function public.is_community_member(community_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.community_members cm
    join public.user_profiles up on up.player_id = cm.player_id
    where cm.community_id = $1
    and up.id = auth.uid()
  ) or public.is_super_admin();
$$ language sql security definer stable;

-- Communities: everyone authenticated can read active ones, super_admin writes all, community admins write own
create policy "communities_read" on public.communities
  for select using (auth.uid() is not null);

create policy "communities_insert" on public.communities
  for insert with check (public.is_super_admin() or auth.uid() is not null);

create policy "communities_update" on public.communities
  for update using (public.is_super_admin() or public.is_community_admin(id));

create policy "communities_delete" on public.communities
  for delete using (public.is_super_admin());

-- Community members: members can read their community's members
create policy "community_members_read" on public.community_members
  for select using (auth.uid() is not null);

create policy "community_members_write" on public.community_members
  for all using (public.is_community_admin(community_id) or public.is_super_admin());

create policy "community_members_self_join" on public.community_members
  for insert with check (
    player_id = (select player_id from public.user_profiles where id = auth.uid())
  );

-- Set your account as super_admin (replace with your actual user ID from auth.users)
-- UPDATE public.user_profiles SET role = 'super_admin' WHERE id = 'YOUR_USER_ID';
