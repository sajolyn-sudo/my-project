CREATE TABLE IF NOT EXISTS user_year_end_history (
  history_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action_type VARCHAR(20) NOT NULL,
  student_name VARCHAR(255) NOT NULL,
  student_email VARCHAR(255) NULL,
  college_name VARCHAR(255) NULL,
  course_name VARCHAR(255) NULL,
  section_name VARCHAR(120) NULL,
  from_year_level_name VARCHAR(120) NULL,
  to_year_level_name VARCHAR(120) NULL,
  academic_year_name VARCHAR(120) NULL,
  action_note VARCHAR(160) NULL,
  action_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_year_end_history_action_type (action_type),
  INDEX idx_user_year_end_history_action_at (action_at),
  INDEX idx_user_year_end_history_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
