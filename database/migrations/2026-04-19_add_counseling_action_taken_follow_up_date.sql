ALTER TABLE counseling
  ADD COLUMN IF NOT EXISTS action_taken TEXT NULL AFTER notes,
  ADD COLUMN IF NOT EXISTS follow_up_date DATE NULL AFTER action_taken;
