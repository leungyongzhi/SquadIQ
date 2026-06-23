-- Allow "unclaimed" goals (counted toward the score but credited to no player)
-- so the recorded score can match the true final score even when nobody claims a goal.
ALTER TABLE public.goals
  ALTER COLUMN scorer_id DROP NOT NULL;
