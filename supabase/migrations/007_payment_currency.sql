-- Add payment currency field to communities (e.g. £, €, $, etc.)
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS payment_currency text NOT NULL DEFAULT '£';
