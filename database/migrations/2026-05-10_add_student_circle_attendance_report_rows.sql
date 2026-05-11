CREATE TABLE IF NOT EXISTS student_circle_attendance_report_rows (
  student_circle_attendance_report_row_id INT AUTO_INCREMENT PRIMARY KEY,
  group_session_id INT NOT NULL,
  report_key VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  group_session_member_id INT NULL,
  source_attendance_id INT NULL,
  student_user_id INT NULL,
  student_name VARCHAR(255) NOT NULL,
  course_id INT NULL,
  course_name VARCHAR(150) NOT NULL,
  year_level_id INT NULL,
  year_level_name VARCHAR(80) NOT NULL,
  phone_number VARCHAR(50) NOT NULL DEFAULT '',
  email VARCHAR(191) NOT NULL DEFAULT '',
  status VARCHAR(64) NOT NULL,
  submitted_at DATETIME NULL,
  signature_data LONGTEXT NULL,
  signature_source ENUM('DRAW','UPLOAD','CAMERA') NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_student_circle_attendance_report_session_key (group_session_id, report_key),
  KEY idx_student_circle_attendance_report_session (group_session_id),
  KEY idx_student_circle_attendance_report_student (student_user_id),
  KEY idx_student_circle_attendance_report_member (group_session_member_id),
  KEY idx_student_circle_attendance_report_status (status),
  CONSTRAINT fk_student_circle_attendance_report_session
    FOREIGN KEY (group_session_id) REFERENCES group_sessions (group_session_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_student_circle_attendance_report_member
    FOREIGN KEY (group_session_member_id) REFERENCES group_session_members (group_session_member_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_student_circle_attendance_report_source_attendance
    FOREIGN KEY (source_attendance_id) REFERENCES student_circle_attendance (student_circle_attendance_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_student_circle_attendance_report_student
    FOREIGN KEY (student_user_id) REFERENCES users (users_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_student_circle_attendance_report_course
    FOREIGN KEY (course_id) REFERENCES courses (course_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_student_circle_attendance_report_year_level
    FOREIGN KEY (year_level_id) REFERENCES year_levels (year_level_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
