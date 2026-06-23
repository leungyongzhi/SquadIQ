-- Add Google Maps link to match events
ALTER TABLE public.match_events
  ADD COLUMN IF NOT EXISTS maps_link text DEFAULT NULL;
