<?php
declare(strict_types=1);

require_once __DIR__ . '/_common.php';

function gcms_table_exists(PDO $pdo, string $table): bool
{
  $stmt = $pdo->prepare(
    'SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1'
  );
  $stmt->execute([$table]);
  return (bool)$stmt->fetchColumn();
}

function gcms_users_column_exists(PDO $pdo, string $column): bool
{
  $stmt = $pdo->prepare(
    'SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "users" AND COLUMN_NAME = ? LIMIT 1'
  );
  $stmt->execute([$column]);
  return (bool)$stmt->fetchColumn();
}

function gcms_ensure_users_section_column(PDO $pdo): void
{
  if (gcms_users_column_exists($pdo, 'section')) return;
  try {
    $pdo->exec('ALTER TABLE users ADD COLUMN section VARCHAR(120) NULL');
  } catch (Throwable $e) {
    // no-op: keep bootstrap working on restricted schemas
  }
}

function gcms_ensure_users_course_column(PDO $pdo): void
{
  if (gcms_users_column_exists($pdo, 'course_id')) return;
  try {
    $pdo->exec('ALTER TABLE users ADD COLUMN course_id INT NULL');
  } catch (Throwable $e) {
    // no-op: keep bootstrap working on restricted schemas
  }
}

function gcms_users_id_col(PDO $pdo): string
{
  $stmt = $pdo->query('SHOW COLUMNS FROM users');
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  foreach ($rows as $row) {
    $field = strtolower((string)($row['Field'] ?? ''));
    if ($field === 'users_id') return 'users_id';
    if ($field === 'id') return 'id';
  }
  gcms_respond(500, ['ok' => false, 'message' => 'users table missing users_id/id']);
  return 'users_id';
}

function gcms_fetch_bootstrap_entities(PDO $pdo): array
{
  gcms_ensure_users_section_column($pdo);
  gcms_ensure_users_course_column($pdo);
  gcms_ensure_user_account_status_table($pdo);
  gcms_ensure_users_archive_columns($pdo);
  $userIdCol = gcms_users_id_col($pdo);
  $hasCoursesTable = gcms_table_exists($pdo, 'courses');
  $hasUsersCourseCol = gcms_users_column_exists($pdo, 'course_id');

  $usernameExpr = "SUBSTRING_INDEX(u.email, '@', 1)";
  if (gcms_users_column_exists($pdo, 'ismis')) {
    $usernameExpr = "COALESCE(NULLIF(u.ismis, ''), SUBSTRING_INDEX(u.email, '@', 1))";
  } elseif (gcms_users_column_exists($pdo, 'username')) {
    $usernameExpr = "COALESCE(NULLIF(u.username, ''), SUBSTRING_INDEX(u.email, '@', 1))";
  }

  $registeredExpr = "CASE WHEN UPPER(COALESCE(u.approval_status, 'APPROVED')) = 'APPROVED' THEN 1 ELSE 0 END";

  $sectionExpr = 'NULL';
  if (gcms_users_column_exists($pdo, 'section')) {
    $sectionExpr = 'u.section';
  }

  $courseIdExpr = 'NULL';
  if ($hasUsersCourseCol) {
    $courseIdExpr = 'u.course_id';
  }

  $courseNameExpr = 'NULL';
  $courseJoinSql = '';
  if ($hasCoursesTable && $hasUsersCourseCol) {
    $courseNameExpr = 'crs.course_name';
    $courseJoinSql = ' LEFT JOIN courses crs ON crs.course_id = u.course_id ';
  }

  $isArchivedExpr = '0';
  if (gcms_users_column_exists($pdo, 'is_archived')) {
    $isArchivedExpr = 'COALESCE(u.is_archived, 0)';
  }

  $archivedAtExpr = 'NULL';
  if (gcms_users_column_exists($pdo, 'archived_at')) {
    $archivedAtExpr = 'u.archived_at';
  }

  $archiveReasonExpr = 'NULL';
  if (gcms_users_column_exists($pdo, 'archive_reason')) {
    $archiveReasonExpr = 'u.archive_reason';
  }

  $usersSql = "
    SELECT
      u.$userIdCol AS id,
      u.fname,
      u.mname,
      u.lname,
      u.email,
      UPPER(REPLACE(REPLACE(COALESCE(NULLIF(u.role, ''), ut.user_type_name, 'STUDENT'), ' ', '_'), '-', '_')) AS role,
      $usernameExpr AS username,
      $registeredExpr AS registered,
      u.college_id AS collegeId,
      u.year_level_id AS yearLevelId,
      $courseIdExpr AS courseId,
      $courseNameExpr AS courseName,
      $sectionExpr AS section,
      $isArchivedExpr AS isArchived,
      $archivedAtExpr AS archivedAt,
      $archiveReasonExpr AS archiveReason
    FROM users u
    LEFT JOIN user_type ut ON ut.user_type_id = u.user_type_id
    $courseJoinSql
    ORDER BY u.$userIdCol DESC
  ";
  $users = $pdo->query($usersSql)->fetchAll(PDO::FETCH_ASSOC);

  $collegesSql = "
    SELECT
      college_id AS id,
      college_name AS name
    FROM colleges
    ORDER BY college_id ASC
  ";
  $colleges = $pdo->query($collegesSql)->fetchAll(PDO::FETCH_ASSOC);

  $yearsSql = "
    SELECT
      academic_year_id AS id,
      academic_year_name AS name,
      is_active AS isActive
    FROM academic_years
    ORDER BY academic_year_id DESC
  ";
  $years = $pdo->query($yearsSql)->fetchAll(PDO::FETCH_ASSOC);

  $yearLevelsSql = "
    SELECT
      year_level_id AS id,
      year_level_name AS name,
      college_id AS collegeId,
      academic_year_id AS academicYearId
    FROM year_levels
    ORDER BY year_level_id ASC
  ";
  $yearLevels = $pdo->query($yearLevelsSql)->fetchAll(PDO::FETCH_ASSOC);

  $courses = [];
  if ($hasCoursesTable) {
    $coursesSql = "
      SELECT
        course_id AS id,
        course_name AS name,
        college_id AS collegeId
      FROM courses
      ORDER BY course_id ASC
    ";
    $courses = $pdo->query($coursesSql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
  }

  return [
    'users' => $users ?: [],
    'colleges' => $colleges ?: [],
    'academicYears' => array_map(
      static fn(array $y): array => [
        'id' => (int)$y['id'],
        'name' => (string)$y['name'],
        'isActive' => (bool)$y['isActive'],
      ],
      $years ?: []
    ),
    'yearLevels' => $yearLevels ?: [],
    'courses' => array_map(
      static fn(array $c): array => [
        'id' => (int)$c['id'],
        'name' => (string)$c['name'],
        'collegeId' => (int)$c['collegeId'],
      ],
      $courses
    ),
  ];
}

function gcms_normalize_case_status(string $status): string
{
  $s = strtolower(trim($status));
  if ($s === 'ongoing') return 'Ongoing';
  if ($s === 'completed' || $s === 'done') return 'Completed';
  return 'Pending';
}

function gcms_normalize_referral_status(string $status): string
{
  $s = strtolower(trim($status));
  if ($s === 'reviewed') return 'Reviewed';
  if ($s === 'closed' || $s === 'resolved') return 'Closed';
  return 'New';
}
