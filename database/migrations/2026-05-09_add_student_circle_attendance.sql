CREATE TABLE IF NOT EXISTS student_circle_attendance (
  student_circle_attendance_id INT AUTO_INCREMENT PRIMARY KEY,
  group_session_id INT NOT NULL,
  student_user_id INT NULL,
  student_name VARCHAR(255) NOT NULL,
  course_id INT NULL,
  course_name VARCHAR(150) NOT NULL,
  year_level_id INT NULL,
  year_level_name VARCHAR(80) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  email VARCHAR(191) NOT NULL,
  signature_data LONGTEXT NOT NULL,
  signature_source ENUM('DRAW','UPLOAD','CAMERA') NOT NULL DEFAULT 'DRAW',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_student_circle_attendance_session_email (group_session_id, email),
  KEY idx_student_circle_attendance_session (group_session_id),
  KEY idx_student_circle_attendance_student (student_user_id),
  KEY idx_student_circle_attendance_course (course_id),
  KEY idx_student_circle_attendance_year_level (year_level_id),
  CONSTRAINT fk_student_circle_attendance_session
    FOREIGN KEY (group_session_id) REFERENCES group_sessions (group_session_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_student_circle_attendance_student
    FOREIGN KEY (student_user_id) REFERENCES users (users_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_student_circle_attendance_course
    FOREIGN KEY (course_id) REFERENCES courses (course_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_student_circle_attendance_year_level
    FOREIGN KEY (year_level_id) REFERENCES year_levels (year_level_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
