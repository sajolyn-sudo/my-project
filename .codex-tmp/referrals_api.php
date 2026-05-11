<?php
declare(strict_types=1);

require_once __DIR__ . '/_entity_helpers.php';

const GCMS_OTHER_REFERRAL_REASON = 'Others (Specify in Notes)';

function gcms_default_referral_reason_options(): array
{
  return [
    'Academics',
    'Attendance and Tardiness',
    'Adjustment',
    'Behavioral Problems',
    'Bullying',
    'Career Choice',
    'Depression',
    'Discipline',
    'Drugs/Drug Abuse',
    'Early Pregnancy',
    'Family Conflicts',
    'Financial',
    'Health',
    'Loss/Death',
    'Love and Relationships',
    'Motivation',
    'Phobia, Panic and Anxiety',
    'Prejudice and Discrimination',
    'Premarital Sex/Sex',
    'Single Parenting/Early Parenthood',
    'Social Relations',
    'Stress',
    'Study Habits',
    'Time Management',
    GCMS_OTHER_REFERRAL_REASON,
  ];
}

function gcms_normalize_referral_status_value(string $status): string
{
  $normalized = strtolower(trim($status));

  if ($normalized === 'approved' || $normalized === 'ongoing' || $normalized === 'reviewed') {
    return 'Approved';
  }
  if (
    $normalized === 'complete' ||
    $normalized === 'completed' ||
    $normalized === 'closed' ||
    $normalized === 'resolved'
  ) {
    return 'Complete';
  }

  return 'Pending';
}

function gcms_referral_user_role(PDO $pdo, int $userId): ?string
{
  if ($userId <= 0) return null;

  $stmt = $pdo->prepare(
    "SELECT UPPER(REPLACE(REPLACE(COALESCE(u.role, ut.user_type_name, ''), ' ', '_'), '-', '_')) AS role
     FROM users u
     LEFT JOIN user_type ut ON ut.user_type_id = u.user_type_id
     WHERE u.users_id = ?
     LIMIT 1"
  );
  $stmt->execute([$userId]);
  $role = $stmt->fetchColumn();

  return $role !== false ? (string)$role : null;
}

function gcms_ensure_referrals_time_column(PDO $pdo): void
{
  $stmt = $pdo->prepare(
    "SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'referrals'
       AND COLUMN_NAME = 'referral_time'
     LIMIT 1"
  );
  $stmt->execute();
  if ($stmt->fetchColumn() !== false) {
    return;
  }

  $pdo->exec('ALTER TABLE referrals ADD COLUMN referral_time TIME NULL AFTER referred_date');
}

function gcms_ensure_referrals_date_nullable(PDO $pdo): void
{
  $stmt = $pdo->prepare(
    "SELECT IS_NULLABLE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'referrals'
       AND COLUMN_NAME = 'referred_date'
     LIMIT 1"
  );
  $stmt->execute();
  $nullable = strtoupper((string)($stmt->fetchColumn() ?: ''));
  if ($nullable === 'YES') {
    return;
  }

  $pdo->exec('ALTER TABLE referrals MODIFY referred_date DATE NULL');
}

function gcms_referral_reason_label(string $raw): string
{
  return preg_replace('/\s+/', ' ', trim($raw)) ?? '';
}

function gcms_referral_reason_key(string $raw): string
{
  return strtolower(gcms_referral_reason_label($raw));
}

function gcms_split_referral_reason_labels(string $text): array
{
  $parts = preg_split('/\s*,\s*/', $text) ?: [];
  $labels = [];
  $seen = [];

  foreach ($parts as $part) {
    $label = gcms_referral_reason_label((string)$part);
    $key = gcms_referral_reason_key($label);
    if ($label === '' || isset($seen[$key])) continue;
    $seen[$key] = true;
    $labels[] = $label;
  }

  return $labels;
}

function gcms_referral_reason_labels_from_payload($payload): array
{
  if (!is_array($payload)) return [];

  $labels = [];
  $seen = [];
  foreach ($payload as $value) {
    $label = gcms_referral_reason_label((string)$value);
    $key = gcms_referral_reason_key($label);
    if ($label === '' || isset($seen[$key])) continue;
    $seen[$key] = true;
    $labels[] = $label;
  }

  return $labels;
}

function gcms_finalize_referral_reason_labels(array $reasonLabels, array $customReasonLabels): array
{
  $customKeys = [];
  foreach ($customReasonLabels as $label) {
    $customKeys[gcms_referral_reason_key($label)] = true;
  }

  $final = [];
  $seen = [];
  foreach ($reasonLabels as $label) {
    $key = gcms_referral_reason_key($label);
    if ($label === '') continue;
    if ($key === gcms_referral_reason_key(GCMS_OTHER_REFERRAL_REASON) && count($customReasonLabels) > 0) {
      continue;
    }
    if (isset($seen[$key])) continue;
    $seen[$key] = true;
    $final[] = $label;
  }

  foreach ($customReasonLabels as $label) {
    $key = gcms_referral_reason_key($label);
    if ($label === '' || isset($seen[$key])) continue;
    $seen[$key] = true;
    $final[] = $label;
  }

  return $final;
}

function gcms_referral_reason_table_exists(PDO $pdo): bool
{
  $stmt = $pdo->prepare(
    "SELECT 1
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'referral_reason_options'
     LIMIT 1"
  );
  $stmt->execute();
  return $stmt->fetchColumn() !== false;
}

function gcms_referral_reason_column_exists(PDO $pdo, string $column): bool
{
  $stmt = $pdo->prepare(
    "SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'referral_reason_options'
       AND COLUMN_NAME = ?
     LIMIT 1"
  );
  $stmt->execute([$column]);
  return $stmt->fetchColumn() !== false;
}

function gcms_ensure_referral_reason_options_table(PDO $pdo): void
{
  if (!gcms_referral_reason_table_exists($pdo)) {
    $pdo->exec(
      "CREATE TABLE referral_reason_options (
        reason_option_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        reason_label VARCHAR(191) NOT NULL,
        sort_order INT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_reason_label (reason_label)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
  }

  if (!gcms_referral_reason_column_exists($pdo, 'sort_order')) {
    $pdo->exec('ALTER TABLE referral_reason_options ADD COLUMN sort_order INT NULL AFTER reason_label');
  }
}

function gcms_store_referral_reason_option(PDO $pdo, string $label, ?int $sortOrder = null): void
{
  $clean = gcms_referral_reason_label($label);
  if ($clean === '') return;

  $stmt = $pdo->prepare(
    'INSERT INTO referral_reason_options (reason_label, sort_order)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       sort_order = COALESCE(referral_reason_options.sort_order, VALUES(sort_order))'
  );
  $stmt->execute([$clean, $sortOrder]);
}

function gcms_seed_referral_reason_options(PDO $pdo): void
{
  foreach (gcms_default_referral_reason_options() as $index => $label) {
    gcms_store_referral_reason_option($pdo, $label, $index + 1);
  }

  $rows = $pdo->query('SELECT reason FROM referrals WHERE reason IS NOT NULL AND TRIM(reason) <> ""')
    ->fetchAll(PDO::FETCH_ASSOC) ?: [];

  foreach ($rows as $row) {
    foreach (gcms_split_referral_reason_labels((string)($row['reason'] ?? '')) as $label) {
      gcms_store_referral_reason_option($pdo, $label, null);
    }
  }
}

function gcms_fetch_referral_reason_options(PDO $pdo): array
{
  $sql = "
    SELECT reason_label
    FROM referral_reason_options
    ORDER BY
      CASE WHEN sort_order IS NULL THEN 1 ELSE 0 END ASC,
      sort_order ASC,
      reason_label ASC
  ";

  $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
  return array_values(
    array_filter(
      array_map(
        static fn(array $row): string => gcms_referral_reason_label((string)($row['reason_label'] ?? '')),
        $rows
      ),
      static fn(string $label): bool => $label !== ''
    )
  );
}

function gcms_fetch_referrals(PDO $pdo): array
{
  $sql = "
    SELECT
      referral_id AS id,
      student_user_id AS studentId,
      referred_by_user_id AS referredByUserId,
      academic_year_id AS academicYearId,
      college_id AS collegeId,
      year_level_id AS yearLevelId,
      DATE_FORMAT(referred_date, '%Y-%m-%d') AS referredDate,
      DATE_FORMAT(referral_time, '%H:%i') AS referredTime,
      reason,
      notes,
      status,
      DATE_FORMAT(created_at, '%Y-%m-%d') AS createdAt
    FROM referrals
    ORDER BY created_at DESC, referral_id DESC
  ";
  $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
  foreach ($rows as &$r) {
    $r['id'] = (int)$r['id'];
    $r['studentId'] = (int)$r['studentId'];
    $r['referredByUserId'] = (int)$r['referredByUserId'];
    $r['academicYearId'] = (int)$r['academicYearId'];
    $r['collegeId'] = (int)$r['collegeId'];
    $r['yearLevelId'] = (int)$r['yearLevelId'];
    $r['referredDate'] = $r['referredDate'] !== null && $r['referredDate'] !== '' ? (string)$r['referredDate'] : null;
    $r['referredTime'] = $r['referredTime'] !== null && $r['referredTime'] !== '' ? (string)$r['referredTime'] : null;
    $r['status'] = gcms_normalize_referral_status_value((string)$r['status']);
    $r['notes'] = $r['notes'] ?? null;
  }
  return $rows;
}

try {
  $pdo = gcms_require_db();
  gcms_ensure_referrals_time_column($pdo);
  gcms_ensure_referrals_date_nullable($pdo);
  gcms_ensure_referral_reason_options_table($pdo);
  gcms_seed_referral_reason_options($pdo);

  $body = gcms_json_input();
  $action = strtolower(trim((string)($body['action'] ?? 'list')));

  if ($action === 'list') {
    gcms_respond(200, [
      'ok' => true,
      'referrals' => gcms_fetch_referrals($pdo),
      'reasonOptions' => gcms_fetch_referral_reason_options($pdo),
    ]);
  }

  if ($action === 'list_reasons') {
    gcms_respond(200, [
      'ok' => true,
      'reasonOptions' => gcms_fetch_referral_reason_options($pdo),
    ]);
  }

  if ($action === 'create') {
    $studentId = (int)($body['studentId'] ?? 0);
    $referredByUserId = (int)($body['referredByUserId'] ?? 0);
    $academicYearId = (int)($body['academicYearId'] ?? 0);
    $collegeId = (int)($body['collegeId'] ?? 0);
    $yearLevelId = (int)($body['yearLevelId'] ?? 0);
    $referredDate = trim((string)($body['referredDate'] ?? ''));
    $referredTime = trim((string)($body['referredTime'] ?? ''));
    $reason = trim((string)($body['reason'] ?? ''));
    $notes = trim((string)($body['notes'] ?? ''));
    $status = gcms_normalize_referral_status_value((string)($body['status'] ?? 'Pending'));
    $customReasons = gcms_referral_reason_labels_from_payload($body['customReasons'] ?? null);
    $finalReasonLabels = gcms_finalize_referral_reason_labels(
      gcms_split_referral_reason_labels($reason),
      $customReasons
    );
    $finalReasonText = implode(', ', $finalReasonLabels);

    if (
      $studentId <= 0 ||
      $referredByUserId <= 0 ||
      $academicYearId <= 0 ||
      $collegeId <= 0 ||
      $yearLevelId <= 0 ||
      $finalReasonText === ''
    ) {
      gcms_respond(400, ['ok' => false, 'message' => 'Missing required fields']);
    }

    if ($status === 'Approved' && ($referredDate === '' || $referredTime === '')) {
      gcms_respond(400, ['ok' => false, 'message' => 'Approved referrals require a scheduled date and time.']);
    }

    if ($studentId === $referredByUserId) {
      gcms_respond(400, ['ok' => false, 'message' => 'You cannot refer yourself.']);
    }

    $studentRole = gcms_referral_user_role($pdo, $studentId);
    if ($studentRole !== 'STUDENT') {
      gcms_respond(400, ['ok' => false, 'message' => 'Referrals can only be created for students.']);
    }

    foreach ($finalReasonLabels as $index => $label) {
      $sortOrder = null;
      foreach (gcms_default_referral_reason_options() as $defaultIndex => $defaultLabel) {
        if (gcms_referral_reason_key($defaultLabel) === gcms_referral_reason_key($label)) {
          $sortOrder = $defaultIndex + 1;
          break;
        }
      }
      gcms_store_referral_reason_option($pdo, $label, $sortOrder);
    }

    $ins = $pdo->prepare(
      'INSERT INTO referrals
        (student_user_id, referred_by_user_id, academic_year_id, college_id, year_level_id, referred_date, referral_time, reason, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $ins->execute([
      $studentId,
      $referredByUserId,
      $academicYearId,
      $collegeId,
      $yearLevelId,
      ($referredDate !== '' ? $referredDate : null),
      ($referredTime !== '' ? $referredTime : null),
      $finalReasonText,
      ($notes !== '' ? $notes : null),
      $status,
    ]);

    gcms_respond(200, [
      'ok' => true,
      'id' => (int)$pdo->lastInsertId(),
      'referrals' => gcms_fetch_referrals($pdo),
      'reasonOptions' => gcms_fetch_referral_reason_options($pdo),
    ]);
  }

  if ($action === 'update') {
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) gcms_respond(400, ['ok' => false, 'message' => 'Invalid id']);

    $existingStmt = $pdo->prepare(
      "SELECT
         DATE_FORMAT(referred_date, '%Y-%m-%d') AS referredDate,
         DATE_FORMAT(referral_time, '%H:%i') AS referredTime
       FROM referrals
       WHERE referral_id = ?
       LIMIT 1"
    );
    $existingStmt->execute([$id]);
    $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);
    if (!$existing) {
      gcms_respond(404, ['ok' => false, 'message' => 'Not found']);
    }

    $status = gcms_normalize_referral_status_value((string)($body['status'] ?? 'Pending'));
    $notes = array_key_exists('notes', $body) ? trim((string)($body['notes'] ?? '')) : null;
    $referredDate = array_key_exists('referredDate', $body)
      ? trim((string)($body['referredDate'] ?? ''))
      : null;
    $referredTime = array_key_exists('referredTime', $body)
      ? trim((string)($body['referredTime'] ?? ''))
      : null;

    $nextReferredDate = $referredDate ?? trim((string)($existing['referredDate'] ?? ''));
    $nextReferredTime = $referredTime ?? trim((string)($existing['referredTime'] ?? ''));
    if ($status === 'Approved' && ($nextReferredDate === '' || $nextReferredTime === '')) {
      gcms_respond(400, ['ok' => false, 'message' => 'Approved referrals require a scheduled date and time.']);
    }

    $updates = ['status = ?'];
    $params = [$status];

    if ($notes !== null) {
      $updates[] = 'notes = ?';
      $params[] = ($notes !== '' ? $notes : null);
    }
    if ($referredDate !== null) {
      $updates[] = 'referred_date = ?';
      $params[] = ($referredDate !== '' ? $referredDate : null);
    }
    if ($referredTime !== null) {
      $updates[] = 'referral_time = ?';
      $params[] = ($referredTime !== '' ? $referredTime : null);
    }

    $params[] = $id;
    $upd = $pdo->prepare('UPDATE referrals SET ' . implode(', ', $updates) . ' WHERE referral_id = ?');
    $upd->execute($params);

    gcms_respond(200, [
      'ok' => true,
      'referrals' => gcms_fetch_referrals($pdo),
      'reasonOptions' => gcms_fetch_referral_reason_options($pdo),
    ]);
  }

  if ($action === 'get') {
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) gcms_respond(400, ['ok' => false, 'message' => 'Invalid id']);
    $all = gcms_fetch_referrals($pdo);
    foreach ($all as $item) {
      if ((int)$item['id'] === $id) {
        gcms_respond(200, [
          'ok' => true,
          'item' => $item,
          'reasonOptions' => gcms_fetch_referral_reason_options($pdo),
        ]);
      }
    }
    gcms_respond(404, ['ok' => false, 'message' => 'Not found']);
  }

  gcms_respond(400, ['ok' => false, 'message' => 'Unsupported action']);
} catch (Throwable $e) {
  gcms_respond(500, ['ok' => false, 'message' => $e->getMessage()]);
}
