-- Fix is_admin() to recognise super_admin role so super admins can manage enrollments
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Add is_enrolled column (tracks active enrolment vs declined/removed)
ALTER TABLE public.event_enrollments
  ADD COLUMN IF NOT EXISTS is_enrolled boolean NOT NULL DEFAULT true;

-- Add form_rating column (aliased from the original form column for code clarity)
ALTER TABLE public.event_enrollments
  ADD COLUMN IF NOT EXISTS form_rating text DEFAULT 'neutral'
    CHECK (form_rating IN ('hot', 'neutral', 'cold'));

-- Add bank_details to communities for bank transfer payment option
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS bank_details text;

-- Add info/rules column for community welcome message, mission, and details
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS info text;

-- Add structured match details (gender, turf, days, time, location) as JSONB
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS community_details jsonb DEFAULT NULL;

-- Add sport type (e.g. Football, Basketball, Rugby) to communities
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS sport_type text;

-- Add form_rating to players (admin-managed, shown on players page)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS form_rating text DEFAULT 'neutral'
    CHECK (form_rating IN ('hot', 'neutral', 'cold'));

-- Add attendance_status to event_enrollments (Late / No Show, admin-recorded)
ALTER TABLE public.event_enrollments
  ADD COLUMN IF NOT EXISTS attendance_status text DEFAULT NULL
    CHECK (attendance_status IN ('late', 'no_show'));

-- Add is_own_goal to goals (own goals don't count toward scorer's tally)
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS is_own_goal boolean NOT NULL DEFAULT false;
