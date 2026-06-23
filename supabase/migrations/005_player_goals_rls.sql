-- Allow players who are in a match to log their own goals, let teammates set the
-- assister, and update the running score. Admins retain full control via existing policies.

-- Helper: the player_id linked to the current auth user
create or replace function public.current_player_id()
returns uuid as $$
  select player_id from public.user_profiles where id = auth.uid();
$$ language sql security definer stable;

-- Goals: a match participant can insert a goal where THEY are the scorer
create policy "goals_participant_insert" on public.goals for insert
  with check (
    public.is_admin() or (
      scorer_id = public.current_player_id() and
      exists (
        select 1 from public.match_events e
        where e.id = goals.event_id and (
          public.current_player_id() = any (e.team_blue_ids) or
          public.current_player_id() = any (e.team_orange_ids)
        )
      )
    )
  );

-- Goals: teammates (same team as the goal) can update a goal — e.g. add the assister
create policy "goals_teammate_update" on public.goals for update
  using (
    public.is_admin() or exists (
      select 1 from public.match_events e
      where e.id = goals.event_id and (
        (goals.team = 'blue'   and public.current_player_id() = any (e.team_blue_ids)) or
        (goals.team = 'orange' and public.current_player_id() = any (e.team_orange_ids))
      )
    )
  );

-- Match events: participants can update (needed to keep the score in sync when logging goals)
create policy "events_participant_update" on public.match_events for update
  using (
    public.is_admin() or
    public.current_player_id() = any (team_blue_ids) or
    public.current_player_id() = any (team_orange_ids)
  );
