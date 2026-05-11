<?php
declare(strict_types=1);

require_once __DIR__ . '/_entity_helpers.php';

function gcms_student_circle_column_exists(PDO $pdo, string $table, string $column): bool
{
  $stmt = $pdo->prepare(
    'SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1'
  );
  $stmt->execute([$table, $column]);
  return (bool)$stmt->fetchColumn();
}

function gcms_ensure_student_circle_attendance_table(PDO $pdo): void
{
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS student_circle_attendance (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
}

function gcms_ensure_student_circle_attendance_link_table(PDO $pdo): void
{
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS student_circle_attendance_links (
      group_session_id INT NOT NULL PRIMARY KEY,
      attendance_token VARCHAR(96) NOT NULL,
      is_open TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY ux_student_circle_attendance_links_token (attendance_token),
      CONSTRAINT fk_student_circle_attendance_links_session
        FOREIGN KEY (group_session_id) REFERENCES group_sessions (group_session_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
}

function gcms_ensure_student_circle_attendance_report_table(PDO $pdo): void
{
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS student_circle_attendance_report_rows (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
}

function gcms_clean_text(string $value, int $maxLength): string
{
  $clean = trim(preg_replace('/\s+/', ' ', $value) ?? '');
  if ($clean === '') return '';
  return function_exists('mb_substr')
    ? mb_substr($clean, 0, $maxLength)
    : substr($clean, 0, $maxLength);
}

function gcms_clean_attendance_token(string $value): string
{
  $token = trim($value);
  return preg_match('/^[A-Za-z0-9_-]{16,128}$/', $token) ? $token : '';
}

function gcms_student_circle_email_key(?string $value): string
{
  return strtolower(trim((string)$value));
}

function gcms_student_circle_full_name(?array $user): string
{
  if (!$user) return 'Unknown';

  return trim(implode(' ', array_filter([
    (string)($user['fname'] ?? ''),
    (string)($user['mname'] ?? ''),
    (string)($user['lname'] ?? ''),
  ]))) ?: 'Unknown';
}

function gcms_generate_student_circle_attendance_token(PDO $pdo): string
{
  $stmt = $pdo->prepare(
    'SELECT 1 FROM student_circle_attendance_links WHERE attendance_token = ? LIMIT 1'
  );

  for ($attempt = 0; $attempt < 6; $attempt++) {
    $token = bin2hex(random_bytes(24));
    $stmt->execute([$token]);
    if (!$stmt->fetchColumn()) {
      return $token;
    }
  }

  throw new RuntimeException('Unable to generate attendance QR token.');
}

function gcms_get_or_create_student_circle_attendance_link(PDO $pdo, int $sessionId): array
{
  $stmt = $pdo->prepare(
    'SELECT attendance_token AS token, is_open AS isOpen
     FROM student_circle_attendance_links
     WHERE group_session_id = ?
     LIMIT 1'
  );
  $stmt->execute([$sessionId]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if (is_array($row)) {
    return [
      'token' => (string)$row['token'],
      'isOpen' => (bool)((int)$row['isOpen']),
    ];
  }

  $token = gcms_generate_student_circle_attendance_token($pdo);
  $insert = $pdo->prepare(
    'INSERT INTO student_circle_attendance_links (group_session_id, attendance_token)
     VALUES (?, ?)'
  );

  try {
    $insert->execute([$sessionId, $token]);
  } catch (Throwable $e) {
    $stmt->execute([$sessionId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (is_array($row)) {
      return [
        'token' => (string)$row['token'],
        'isOpen' => (bool)((int)$row['isOpen']),
      ];
    }
    throw $e;
  }

  return ['token' => $token, 'isOpen' => true];
}

function gcms_require_student_circle_attendance_token(PDO $pdo, int $sessionId, string $token): array
{
  $cleanToken = gcms_clean_attendance_token($token);
  if ($cleanToken === '') {
    gcms_respond(403, [
      'ok' => false,
      'message' => 'This attendance QR link is missing or invalid. Please scan the latest QR code from your facilitator.',
    ]);
  }

  $stmt = $pdo->prepare(
    'SELECT attendance_token AS token, is_open AS isOpen
     FROM student_circle_attendance_links
     WHERE group_session_id = ? AND attendance_token = ?
     LIMIT 1'
  );
  $stmt->execute([$sessionId, $cleanToken]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!is_array($row)) {
    gcms_respond(403, [
      'ok' => false,
      'message' => 'This attendance QR link is invalid. Please scan the latest QR code from your facilitator.',
    ]);
  }

  if (!((int)$row['isOpen'])) {
    gcms_respond(403, [
      'ok' => false,
      'message' => 'Attendance for this Group Counselling session is already closed.',
    ]);
  }

  return [
    'token' => (string)$row['token'],
    'isOpen' => (bool)((int)$row['isOpen']),
  ];
}

function gcms_fetch_student_circle_session(PDO $pdo, int $sessionId): ?array
{
  $stmt = $pdo->prepare(
    "SELECT
      gs.group_session_id AS id,
      gs.academic_year_id AS academicYearId,
      gs.college_id AS collegeId,
      gs.course_id AS courseId,
      gs.year_level_id AS yearLevelId,
      DATE_FORMAT(gs.session_date, '%Y-%m-%d') AS date,
      DATE_FORMAT(gs.session_time, '%H:%i') AS time,
      gs.location,
      gs.topic,
      gs.facilitator,
      gs.notes,
      c.college_name AS collegeName,
      crs.course_name AS courseName,
      yl.year_level_name AS yearLevelName,
      ay.academic_year_name AS academicYearName
     FROM group_sessions gs
     INNER JOIN colleges c ON c.college_id = gs.college_id
     LEFT JOIN courses crs ON crs.course_id = gs.course_id
     INNER JOIN year_levels yl ON yl.year_level_id = gs.year_level_id
     INNER JOIN academic_years ay ON ay.academic_year_id = gs.academic_year_id
     WHERE gs.group_session_id = ?
     LIMIT 1"
  );
  $stmt->execute([$sessionId]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!is_array($row)) return null;

  return [
    'id' => (int)$row['id'],
    'academicYearId' => (int)$row['academicYearId'],
    'collegeId' => (int)$row['collegeId'],
    'courseId' => isset($row['courseId']) && $row['courseId'] !== null ? (int)$row['courseId'] : null,
    'yearLevelId' => (int)$row['yearLevelId'],
    'date' => (string)$row['date'],
    'time' => $row['time'] !== null ? (string)$row['time'] : null,
    'location' => (string)$row['location'],
    'topic' => (string)$row['topic'],
    'facilitator' => $row['facilitator'] !== null ? (string)$row['facilitator'] : null,
    'notes' => $row['notes'] !== null ? (string)$row['notes'] : null,
    'collegeName' => (string)$row['collegeName'],
    'courseName' => $row['courseName'] !== null ? (string)$row['courseName'] : null,
    'yearLevelName' => (string)$row['yearLevelName'],
    'academicYearName' => (string)$row['academicYearName'],
  ];
}

function gcms_fetch_student_circle_attendance(PDO $pdo, int $sessionId): array
{
  $stmt = $pdo->prepare(
    "SELECT
      student_circle_attendance_id AS id,
      group_session_id AS groupSessionId,
      student_user_id AS studentUserId,
      student_name AS studentName,
      course_id AS courseId,
      course_name AS courseName,
      year_level_id AS yearLevelId,
      year_level_name AS yearLevelName,
      phone_number AS phoneNumber,
      email,
      signature_data AS signatureData,
      signature_source AS signatureSource,
      DATE_FORMAT(submitted_at, '%Y-%m-%d %H:%i:%s') AS submittedAt,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
      DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
     FROM student_circle_attendance
     WHERE group_session_id = ?
     ORDER BY submitted_at DESC, student_circle_attendance_id DESC"
  );
  $stmt->execute([$sessionId]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

  foreach ($rows as &$row) {
    $row['id'] = (int)$row['id'];
    $row['groupSessionId'] = (int)$row['groupSessionId'];
    $row['studentUserId'] = isset($row['studentUserId']) && $row['studentUserId'] !== null
      ? (int)$row['studentUserId']
      : null;
    $row['courseId'] = isset($row['courseId']) && $row['courseId'] !== null ? (int)$row['courseId'] : null;
    $row['yearLevelId'] = isset($row['yearLevelId']) && $row['yearLevelId'] !== null
      ? (int)$row['yearLevelId']
      : null;
  }

  return $rows;
}

function gcms_fetch_student_circle_attendance_report(PDO $pdo, int $sessionId): array
{
  $stmt = $pdo->prepare(
    "SELECT
      student_circle_attendance_report_row_id AS id,
      group_session_id AS groupSessionId,
      report_key AS reportKey,
      sort_order AS sortOrder,
      group_session_member_id AS groupSessionMemberId,
      source_attendance_id AS sourceAttendanceId,
      student_user_id AS studentUserId,
      student_name AS studentName,
      course_id AS courseId,
      course_name AS courseName,
      year_level_id AS yearLevelId,
      year_level_name AS yearLevelName,
      phone_number AS phoneNumber,
      email,
      status,
      DATE_FORMAT(submitted_at, '%Y-%m-%d %H:%i:%s') AS submittedAt,
      signature_data AS signatureData,
      signature_source AS signatureSource,
      DATE_FORMAT(generated_at, '%Y-%m-%d %H:%i:%s') AS generatedAt,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
      DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
     FROM student_circle_attendance_report_rows
     WHERE group_session_id = ?
     ORDER BY sort_order ASC, student_circle_attendance_report_row_id ASC"
  );
  $stmt->execute([$sessionId]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

  foreach ($rows as &$row) {
    $row['id'] = (int)$row['id'];
    $row['groupSessionId'] = (int)$row['groupSessionId'];
    $row['sortOrder'] = (int)$row['sortOrder'];
    $row['groupSessionMemberId'] = isset($row['groupSessionMemberId']) && $row['groupSessionMemberId'] !== null
      ? (int)$row['groupSessionMemberId']
      : null;
    $row['sourceAttendanceId'] = isset($row['sourceAttendanceId']) && $row['sourceAttendanceId'] !== null
      ? (int)$row['sourceAttendanceId']
      : null;
    $row['studentUserId'] = isset($row['studentUserId']) && $row['studentUserId'] !== null
      ? (int)$row['studentUserId']
      : null;
    $row['courseId'] = isset($row['courseId']) && $row['courseId'] !== null
      ? (int)$row['courseId']
      : null;
    $row['yearLevelId'] = isset($row['yearLevelId']) && $row['yearLevelId'] !== null
      ? (int)$row['yearLevelId']
      : null;
    $row['signatureSource'] = $row['signatureSource'] !== null ? (string)$row['signatureSource'] : null;
  }

  return $rows;
}

function gcms_fetch_student_circle_member_roster(PDO $pdo, int $sessionId): array
{
  gcms_ensure_users_course_column($pdo);

  $userIdCol = gcms_users_id_col($pdo);
  $hasUsersCourseCol = gcms_users_column_exists($pdo, 'course_id');
  $hasCoursesTable = gcms_table_exists($pdo, 'courses');
  $courseIdExpr = $hasUsersCourseCol ? 'u.course_id' : 'NULL';
  $courseNameExpr = $hasUsersCourseCol && $hasCoursesTable ? 'crs.course_name' : 'NULL';
  $courseJoinSql = $hasUsersCourseCol && $hasCoursesTable
    ? ' LEFT JOIN courses crs ON crs.course_id = u.course_id '
    : '';

  $stmt = $pdo->prepare(
    "SELECT
      gsm.group_session_member_id AS memberId,
      gsm.student_user_id AS studentUserId,
      u.fname,
      u.mname,
      u.lname,
      u.email,
      $courseIdExpr AS courseId,
      $courseNameExpr AS courseName,
      u.year_level_id AS yearLevelId,
      yl.year_level_name AS yearLevelName
     FROM group_session_members gsm
     LEFT JOIN users u ON u.$userIdCol = gsm.student_user_id
     $courseJoinSql
     LEFT JOIN year_levels yl ON yl.year_level_id = u.year_level_id
     WHERE gsm.group_session_id = ?
     ORDER BY gsm.group_session_member_id ASC"
  );
  $stmt->execute([$sessionId]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

  foreach ($rows as &$row) {
    $row['memberId'] = (int)$row['memberId'];
    $row['studentUserId'] = (int)$row['studentUserId'];
    $row['courseId'] = isset($row['courseId']) && $row['courseId'] !== null ? (int)$row['courseId'] : null;
    $row['yearLevelId'] = isset($row['yearLevelId']) && $row['yearLevelId'] !== null
      ? (int)$row['yearLevelId']
      : null;
  }

  return $rows;
}

function gcms_build_student_circle_attendance_report_rows(PDO $pdo, int $sessionId): array
{
  $session = gcms_fetch_student_circle_session($pdo, $sessionId);
  if (!$session) {
    throw new RuntimeException('Student Circle not found');
  }

  $attendance = gcms_fetch_student_circle_attendance($pdo, $sessionId);
  $members = gcms_fetch_student_circle_member_roster($pdo, $sessionId);

  $attendanceByStudentId = [];
  $attendanceByEmail = [];
  foreach ($attendance as $row) {
    if (isset($row['studentUserId']) && $row['studentUserId'] !== null) {
      $attendanceByStudentId[(int)$row['studentUserId']] = $row;
    }
    $emailKey = gcms_student_circle_email_key($row['email'] ?? '');
    if ($emailKey !== '') {
      $attendanceByEmail[$emailKey] = $row;
    }
  }

  $usedAttendanceIds = [];
  $rows = [];

  foreach ($members as $member) {
    $matched = null;
    if (isset($attendanceByStudentId[$member['studentUserId']])) {
      $matched = $attendanceByStudentId[$member['studentUserId']];
    } else {
      $memberEmailKey = gcms_student_circle_email_key($member['email'] ?? '');
      if ($memberEmailKey !== '' && isset($attendanceByEmail[$memberEmailKey])) {
        $matched = $attendanceByEmail[$memberEmailKey];
      }
    }

    if (is_array($matched)) {
      $usedAttendanceIds[(int)$matched['id']] = true;
    }

    $courseId = isset($matched['courseId']) && $matched['courseId'] !== null
      ? (int)$matched['courseId']
      : (isset($member['courseId']) && $member['courseId'] !== null
        ? (int)$member['courseId']
        : ($session['courseId'] !== null ? (int)$session['courseId'] : null));
    $yearLevelId = isset($matched['yearLevelId']) && $matched['yearLevelId'] !== null
      ? (int)$matched['yearLevelId']
      : (isset($member['yearLevelId']) && $member['yearLevelId'] !== null
        ? (int)$member['yearLevelId']
        : ($session['yearLevelId'] !== null ? (int)$session['yearLevelId'] : null));

    $rows[] = [
      'reportKey' => 'member-' . $member['memberId'],
      'groupSessionId' => $sessionId,
      'groupSessionMemberId' => (int)$member['memberId'],
      'sourceAttendanceId' => is_array($matched) ? (int)$matched['id'] : null,
      'studentUserId' => (int)$member['studentUserId'],
      'studentName' => is_array($matched) && trim((string)($matched['studentName'] ?? '')) !== ''
        ? (string)$matched['studentName']
        : gcms_student_circle_full_name($member),
      'courseId' => $courseId,
      'courseName' => is_array($matched) && trim((string)($matched['courseName'] ?? '')) !== ''
        ? (string)$matched['courseName']
        : ((string)($member['courseName'] ?? '') !== ''
          ? (string)$member['courseName']
          : (string)($session['courseName'] ?? '-')),
      'yearLevelId' => $yearLevelId,
      'yearLevelName' => is_array($matched) && trim((string)($matched['yearLevelName'] ?? '')) !== ''
        ? (string)$matched['yearLevelName']
        : ((string)($member['yearLevelName'] ?? '') !== ''
          ? (string)$member['yearLevelName']
          : (string)($session['yearLevelName'] ?? '-')),
      'phoneNumber' => is_array($matched) ? (string)($matched['phoneNumber'] ?? '') : '',
      'email' => is_array($matched) && trim((string)($matched['email'] ?? '')) !== ''
        ? (string)$matched['email']
        : (string)($member['email'] ?? ''),
      'status' => 'Present',
      'submittedAt' => is_array($matched) ? ($matched['submittedAt'] ?? null) : null,
      'signatureData' => is_array($matched) ? ($matched['signatureData'] ?? null) : null,
      'signatureSource' => is_array($matched) ? ($matched['signatureSource'] ?? null) : null,
    ];
  }

  usort($rows, static function (array $a, array $b): int {
    return strcasecmp((string)$a['studentName'], (string)$b['studentName']);
  });

  foreach ($attendance as $row) {
    if (isset($usedAttendanceIds[(int)$row['id']])) {
      continue;
    }

    $rows[] = [
      'reportKey' => 'attendance-' . (int)$row['id'],
      'groupSessionId' => $sessionId,
      'groupSessionMemberId' => null,
      'sourceAttendanceId' => (int)$row['id'],
      'studentUserId' => isset($row['studentUserId']) && $row['studentUserId'] !== null
        ? (int)$row['studentUserId']
        : null,
      'studentName' => (string)$row['studentName'],
      'courseId' => isset($row['courseId']) && $row['courseId'] !== null ? (int)$row['courseId'] : null,
      'courseName' => (string)($row['courseName'] ?? '-'),
      'yearLevelId' => isset($row['yearLevelId']) && $row['yearLevelId'] !== null ? (int)$row['yearLevelId'] : null,
      'yearLevelName' => (string)($row['yearLevelName'] ?? '-'),
      'phoneNumber' => (string)($row['phoneNumber'] ?? ''),
      'email' => (string)($row['email'] ?? ''),
      'status' => 'Present (not in member list)',
      'submittedAt' => $row['submittedAt'] ?? null,
      'signatureData' => $row['signatureData'] ?? null,
      'signatureSource' => $row['signatureSource'] ?? null,
    ];
  }

  return $rows;
}

function gcms_store_student_circle_attendance_report(PDO $pdo, int $sessionId, array $rows): array
{
  $deleteStmt = $pdo->prepare(
    'DELETE FROM student_circle_attendance_report_rows WHERE group_session_id = ?'
  );
  $insertStmt = $pdo->prepare(
    "INSERT INTO student_circle_attendance_report_rows
      (group_session_id, report_key, sort_order, group_session_member_id, source_attendance_id,
       student_user_id, student_name, course_id, course_name, year_level_id, year_level_name,
       phone_number, email, status, submitted_at, signature_data, signature_source, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())"
  );

  try {
    if (!$pdo->inTransaction()) {
      $pdo->beginTransaction();
    }

    $deleteStmt->execute([$sessionId]);

    foreach (array_values($rows) as $index => $row) {
      $insertStmt->execute([
        $sessionId,
        (string)$row['reportKey'],
        $index,
        $row['groupSessionMemberId'],
        $row['sourceAttendanceId'],
        $row['studentUserId'],
        gcms_clean_text((string)$row['studentName'], 255),
        $row['courseId'],
        gcms_clean_text((string)$row['courseName'], 150) ?: '-',
        $row['yearLevelId'],
        gcms_clean_text((string)$row['yearLevelName'], 80) ?: '-',
        gcms_clean_text((string)($row['phoneNumber'] ?? ''), 50),
        strtolower(gcms_clean_text((string)($row['email'] ?? ''), 191)),
        gcms_clean_text((string)$row['status'], 64) ?: 'Absent',
        $row['submittedAt'] ?: null,
        $row['signatureData'] ?: null,
        $row['signatureSource'] ?: null,
      ]);
    }

    if ($pdo->inTransaction()) {
      $pdo->commit();
    }
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    throw $e;
  }

  return gcms_fetch_student_circle_attendance_report($pdo, $sessionId);
}

function gcms_make_student_circle_attendance_report_payload(int $sessionId, array $rows): array
{
  $expectedCount = 0;
  $presentCount = 0;
  $absentCount = 0;
  $extraSubmissionCount = 0;
  $generatedAtTs = 0;
  $generatedAt = null;

  foreach ($rows as $row) {
    if (isset($row['groupSessionMemberId']) && $row['groupSessionMemberId'] !== null) {
      $expectedCount++;
    }

    $status = (string)($row['status'] ?? '');
    if ($status === 'Present') {
      $presentCount++;
    } elseif ($status === 'Absent') {
      $absentCount++;
    } elseif ($status === 'Present (not in member list)') {
      $extraSubmissionCount++;
    }

    $rowGeneratedAt = (string)($row['generatedAt'] ?? '');
    $rowTs = $rowGeneratedAt !== '' ? strtotime($rowGeneratedAt) : false;
    if ($rowTs !== false && $rowTs >= $generatedAtTs) {
      $generatedAtTs = (int)$rowTs;
      $generatedAt = $rowGeneratedAt;
    }
  }

  return [
    'sessionId' => $sessionId,
    'expectedCount' => $expectedCount,
    'presentCount' => $presentCount,
    'absentCount' => $absentCount,
    'extraSubmissionCount' => $extraSubmissionCount,
    'generatedAt' => $generatedAt,
    'rows' => $rows,
  ];
}

function gcms_fetch_student_circle_attendance_status(
  PDO $pdo,
  int $sessionId,
  ?int $studentUserId,
  string $email
): ?array {
  if ($studentUserId !== null && $studentUserId > 0) {
    $stmt = $pdo->prepare(
      "SELECT DATE_FORMAT(submitted_at, '%Y-%m-%d %H:%i:%s') AS submittedAt
       FROM student_circle_attendance
       WHERE group_session_id = ? AND student_user_id = ?
       LIMIT 1"
    );
    $stmt->execute([$sessionId, $studentUserId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (is_array($row)) return $row;
  }

  if ($email !== '') {
    $stmt = $pdo->prepare(
      "SELECT DATE_FORMAT(submitted_at, '%Y-%m-%d %H:%i:%s') AS submittedAt
       FROM student_circle_attendance
       WHERE group_session_id = ? AND LOWER(email) = LOWER(?)
       LIMIT 1"
    );
    $stmt->execute([$sessionId, $email]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (is_array($row)) return $row;
  }

  return null;
}

function gcms_find_student_user_id(PDO $pdo, string $email): ?int
{
  $stmt = $pdo->prepare('SELECT users_id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1');
  $stmt->execute([$email]);
  $id = $stmt->fetchColumn();
  return $id !== false ? (int)$id : null;
}

function gcms_lookup_course_name(PDO $pdo, int $courseId): ?string
{
  if ($courseId <= 0) return null;
  $stmt = $pdo->prepare('SELECT course_name FROM courses WHERE course_id = ? LIMIT 1');
  $stmt->execute([$courseId]);
  $value = $stmt->fetchColumn();
  return $value !== false ? (string)$value : null;
}

function gcms_lookup_year_level_name(PDO $pdo, int $yearLevelId): ?string
{
  if ($yearLevelId <= 0) return null;
  $stmt = $pdo->prepare('SELECT year_level_name FROM year_levels WHERE year_level_id = ? LIMIT 1');
  $stmt->execute([$yearLevelId]);
  $value = $stmt->fetchColumn();
  return $value !== false ? (string)$value : null;
}

try {
  $pdo = gcms_require_db();
  gcms_ensure_student_circle_attendance_table($pdo);
  gcms_ensure_student_circle_attendance_link_table($pdo);
  gcms_ensure_student_circle_attendance_report_table($pdo);
  $body = gcms_json_input();
  $action = strtolower(trim((string)($body['action'] ?? 'get_session')));

  if ($action === 'get_link') {
    $sessionId = (int)($body['sessionId'] ?? $body['id'] ?? 0);
    if ($sessionId <= 0) {
      gcms_respond(400, ['ok' => false, 'message' => 'Invalid session id']);
    }

    $session = gcms_fetch_student_circle_session($pdo, $sessionId);
    if (!$session) {
      gcms_respond(404, ['ok' => false, 'message' => 'Student Circle not found']);
    }

    $link = gcms_get_or_create_student_circle_attendance_link($pdo, $sessionId);
    gcms_respond(200, [
      'ok' => true,
      'sessionId' => $sessionId,
      'token' => $link['token'],
      'isOpen' => $link['isOpen'],
    ]);
  }

  if ($action === 'get_session') {
    $sessionId = (int)($body['sessionId'] ?? $body['id'] ?? 0);
    $token = (string)($body['token'] ?? $body['attendanceToken'] ?? '');
    if ($sessionId <= 0) {
      gcms_respond(400, ['ok' => false, 'message' => 'Invalid session id']);
    }

    $session = gcms_fetch_student_circle_session($pdo, $sessionId);
    if (!$session) {
      gcms_respond(404, ['ok' => false, 'message' => 'Student Circle not found']);
    }
    gcms_require_student_circle_attendance_token($pdo, $sessionId, $token);

    gcms_respond(200, ['ok' => true, 'session' => $session]);
  }

  if ($action === 'get_status') {
    $sessionId = (int)($body['sessionId'] ?? 0);
    $token = (string)($body['token'] ?? $body['attendanceToken'] ?? '');
    $studentUserId = isset($body['studentUserId']) ? (int)$body['studentUserId'] : null;
    $email = strtolower(gcms_clean_text((string)($body['email'] ?? ''), 191));

    if ($sessionId <= 0) {
      gcms_respond(400, ['ok' => false, 'message' => 'Invalid session id']);
    }
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
      gcms_respond(400, ['ok' => false, 'message' => 'Please enter a valid email address.']);
    }

    gcms_require_student_circle_attendance_token($pdo, $sessionId, $token);
    $row = gcms_fetch_student_circle_attendance_status(
      $pdo,
      $sessionId,
      $studentUserId,
      $email
    );

    gcms_respond(200, [
      'ok' => true,
      'submitted' => is_array($row),
      'submittedAt' => is_array($row) ? (string)$row['submittedAt'] : null,
    ]);
  }

  if ($action === 'list') {
    $sessionId = (int)($body['sessionId'] ?? 0);
    if ($sessionId <= 0) {
      gcms_respond(400, ['ok' => false, 'message' => 'Invalid session id']);
    }
    gcms_respond(200, [
      'ok' => true,
      'attendance' => gcms_fetch_student_circle_attendance($pdo, $sessionId),
    ]);
  }

  if ($action === 'list_report' || $action === 'generate_report') {
    $sessionId = (int)($body['sessionId'] ?? 0);
    $regenerate = (bool)($body['regenerate'] ?? false);
    if ($sessionId <= 0) {
      gcms_respond(400, ['ok' => false, 'message' => 'Invalid session id']);
    }

    $session = gcms_fetch_student_circle_session($pdo, $sessionId);
    if (!$session) {
      gcms_respond(404, ['ok' => false, 'message' => 'Student Circle not found']);
    }

    $rows = gcms_fetch_student_circle_attendance_report($pdo, $sessionId);
    if ($action === 'generate_report' || $regenerate || !$rows) {
      $rows = gcms_store_student_circle_attendance_report(
        $pdo,
        $sessionId,
        gcms_build_student_circle_attendance_report_rows($pdo, $sessionId)
      );
    }

    gcms_respond(200, [
      'ok' => true,
      'report' => gcms_make_student_circle_attendance_report_payload($sessionId, $rows),
    ]);
  }

  if ($action === 'submit') {
    $sessionId = (int)($body['sessionId'] ?? 0);
    $token = (string)($body['token'] ?? $body['attendanceToken'] ?? '');
    $studentName = gcms_clean_text((string)($body['studentName'] ?? $body['name'] ?? ''), 255);
    $phoneNumber = gcms_clean_text((string)($body['phoneNumber'] ?? $body['phone'] ?? ''), 50);
    $email = strtolower(gcms_clean_text((string)($body['email'] ?? ''), 191));
    $courseId = (int)($body['courseId'] ?? 0);
    $courseName = gcms_clean_text((string)($body['courseName'] ?? $body['course'] ?? ''), 150);
    $yearLevelId = (int)($body['yearLevelId'] ?? 0);
    $yearLevelName = gcms_clean_text((string)($body['yearLevelName'] ?? $body['yearLevel'] ?? ''), 80);
    $signatureData = trim((string)($body['signatureData'] ?? $body['signature'] ?? ''));
    $signatureSource = strtoupper(gcms_clean_text((string)($body['signatureSource'] ?? 'DRAW'), 20));

    if ($sessionId <= 0) {
      gcms_respond(400, ['ok' => false, 'message' => 'Invalid session id']);
    }
    if (!$studentName || !$phoneNumber || !$email || !$courseName || !$yearLevelName || !$signatureData) {
      gcms_respond(400, ['ok' => false, 'message' => 'Please complete all attendance fields.']);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
      gcms_respond(400, ['ok' => false, 'message' => 'Please enter a valid email address.']);
    }
    if (!in_array($signatureSource, ['DRAW', 'UPLOAD', 'CAMERA'], true)) {
      $signatureSource = 'DRAW';
    }
    if (strlen($signatureData) > 5 * 1024 * 1024) {
      gcms_respond(413, ['ok' => false, 'message' => 'Signature image is too large.']);
    }
    if (!preg_match('/^data:image\/(png|jpeg|jpg|webp);base64,/i', $signatureData)) {
      gcms_respond(400, ['ok' => false, 'message' => 'Signature must be a PNG, JPG, or WebP image.']);
    }

    $session = gcms_fetch_student_circle_session($pdo, $sessionId);
    if (!$session) {
      gcms_respond(404, ['ok' => false, 'message' => 'Student Circle not found']);
    }
    gcms_require_student_circle_attendance_token($pdo, $sessionId, $token);

    $lookedUpCourseName = gcms_lookup_course_name($pdo, $courseId);
    if ($lookedUpCourseName !== null) {
      $courseName = $lookedUpCourseName;
    }

    $lookedUpYearLevelName = gcms_lookup_year_level_name($pdo, $yearLevelId);
    if ($lookedUpYearLevelName !== null) {
      $yearLevelName = $lookedUpYearLevelName;
    }

    $studentUserId = gcms_find_student_user_id($pdo, $email);

    $stmt = $pdo->prepare(
      "INSERT INTO student_circle_attendance
        (group_session_id, student_user_id, student_name, course_id, course_name,
         year_level_id, year_level_name, phone_number, email, signature_data, signature_source, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         student_user_id = VALUES(student_user_id),
         student_name = VALUES(student_name),
         course_id = VALUES(course_id),
         course_name = VALUES(course_name),
         year_level_id = VALUES(year_level_id),
         year_level_name = VALUES(year_level_name),
         phone_number = VALUES(phone_number),
         signature_data = VALUES(signature_data),
         signature_source = VALUES(signature_source),
         submitted_at = NOW()"
    );
    $stmt->execute([
      $sessionId,
      $studentUserId,
      $studentName,
      $courseId > 0 ? $courseId : null,
      $courseName,
      $yearLevelId > 0 ? $yearLevelId : null,
      $yearLevelName,
      $phoneNumber,
      $email,
      $signatureData,
      $signatureSource,
    ]);

    $attendanceRows = gcms_fetch_student_circle_attendance($pdo, $sessionId);
    $reportRows = gcms_store_student_circle_attendance_report(
      $pdo,
      $sessionId,
      gcms_build_student_circle_attendance_report_rows($pdo, $sessionId)
    );

    gcms_respond(200, [
      'ok' => true,
      'message' => 'Attendance submitted.',
      'attendance' => $attendanceRows,
      'report' => gcms_make_student_circle_attendance_report_payload($sessionId, $reportRows),
    ]);
  }

  gcms_respond(400, ['ok' => false, 'message' => 'Unsupported action']);
} catch (Throwable $e) {
  gcms_respond(500, ['ok' => false, 'message' => $e->getMessage()]);
}
