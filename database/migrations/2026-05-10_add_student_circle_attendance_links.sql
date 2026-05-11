CREATE TABLE IF NOT EXISTS student_circle_attendance_links (
  group_session_id INT NOT NULL PRIMARY KEY,
  attendance_token VARCHAR(96) NOT NULL,
  is_open TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_student_circle_attendance_links_token (attendance_token),
  CONSTRAINT fk_student_circle_attendance_links_session
    FOREIGN KEY (group_session_id) REFERENCES group_sessions (group_session_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
