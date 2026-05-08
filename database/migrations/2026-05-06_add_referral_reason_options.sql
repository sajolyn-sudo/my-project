CREATE TABLE IF NOT EXISTS referral_reason_options (
  reason_option_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reason_label VARCHAR(191) NOT NULL,
  sort_order INT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_reason_label (reason_label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO referral_reason_options (reason_label, sort_order) VALUES
  ('Academics', 1),
  ('Attendance and Tardiness', 2),
  ('Adjustment', 3),
  ('Behavioral Problems', 4),
  ('Bullying', 5),
  ('Career Choice', 6),
  ('Depression', 7),
  ('Discipline', 8),
  ('Drugs/Drug Abuse', 9),
  ('Early Pregnancy', 10),
  ('Family Conflicts', 11),
  ('Financial', 12),
  ('Health', 13),
  ('Loss/Death', 14),
  ('Love and Relationships', 15),
  ('Motivation', 16),
  ('Phobia, Panic and Anxiety', 17),
  ('Prejudice and Discrimination', 18),
  ('Premarital Sex/Sex', 19),
  ('Single Parenting/Early Parenthood', 20),
  ('Social Relations', 21),
  ('Stress', 22),
  ('Study Habits', 23),
  ('Time Management', 24),
  ('Others (Specify in Notes)', 25)
ON DUPLICATE KEY UPDATE
  sort_order = COALESCE(referral_reason_options.sort_order, VALUES(sort_order));
