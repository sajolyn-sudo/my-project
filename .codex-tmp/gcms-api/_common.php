<?php
declare(strict_types=1);

function gcms_set_cors_headers(): void
{
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

  if ($origin && preg_match('/^http:\/\/localhost(?::\d+)?$/', $origin)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
  } else {
    header('Access-Control-Allow-Origin: *');
  }

  header('Access-Control-Allow-Headers: Content-Type, Authorization');
  header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
}

gcms_set_cors_headers();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
  http_response_code(200);
  exit;
}

header('Content-Type: application/json; charset=UTF-8');

function gcms_json_input(): array
{
  $raw = file_get_contents('php://input');
  if ($raw === false || trim($raw) === '') {
    return [];
  }

  $decoded = json_decode($raw, true);
  return is_array($decoded) ? $decoded : [];
}

function gcms_respond(int $status, array $payload): void
{
  http_response_code($status);
  echo json_encode($payload);
  exit;
}

function gcms_require_db(): PDO
{
  require __DIR__ . '/db.php';

  if (!isset($pdo) || !($pdo instanceof PDO)) {
    gcms_respond(500, ['ok' => false, 'message' => 'DB connection unavailable']);
  }

  return $pdo;
}

function gcms_ensure_state_table(PDO $pdo): void
{
  $pdo->exec(
    'CREATE TABLE IF NOT EXISTS app_state (
      state_key VARCHAR(191) PRIMARY KEY,
      state_json LONGTEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
  );
}

function gcms_common_table_exists(PDO $pdo, string $table): bool
{
  $stmt = $pdo->prepare(
    'SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1'
  );
  $stmt->execute([$table]);
  return (bool)$stmt->fetchColumn();
}

function gcms_common_users_column_exists(PDO $pdo, string $column): bool
{
  $stmt = $pdo->prepare(
    'SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "users" AND COLUMN_NAME = ? LIMIT 1'
  );
  $stmt->execute([$column]);
  return (bool)$stmt->fetchColumn();
}

function gcms_common_users_id_col(PDO $pdo): string
{
  $stmt = $pdo->query('SHOW COLUMNS FROM users');
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
  foreach ($rows as $row) {
    $field = strtolower((string)($row['Field'] ?? ''));
    if ($field === 'users_id') return 'users_id';
    if ($field === 'id') return 'id';
  }
  return 'users_id';
}

function gcms_ensure_users_role_column(PDO $pdo): void
{
  if (!gcms_common_users_column_exists($pdo, 'role')) {
    try {
      $pdo->exec('ALTER TABLE users ADD COLUMN role VARCHAR(64) NULL');
    } catch (Throwable $e) {
      return;
    }
  }

  $hasUserTypeId = gcms_common_users_column_exists($pdo, 'user_type_id');
  $hasUserType = gcms_common_users_column_exists($pdo, 'user_type');
  $roleExpr = "'STUDENT'";
  $joinSql = '';

  if ($hasUserTypeId && gcms_common_table_exists($pdo, 'user_type')) {
    $roleExpr = "UPPER(REPLACE(REPLACE(COALESCE(ut.user_type_name, 'STUDENT'), ' ', '_'), '-', '_'))";
    $joinSql = ' LEFT JOIN user_type ut ON ut.user_type_id = u.user_type_id ';
  } elseif ($hasUserType) {
    $roleExpr = "UPPER(REPLACE(REPLACE(COALESCE(u.user_type, 'STUDENT'), ' ', '_'), '-', '_'))";
  }

  try {
    $pdo->exec(
      "UPDATE users u
       $joinSql
       SET u.role = $roleExpr"
    );
  } catch (Throwable $e) {
    // keep API usable even if sync fails
  }
}

function gcms_ensure_user_account_status_table(PDO $pdo): void
{
  $definitions = [
    'email_verified' => 'TINYINT(1) NOT NULL DEFAULT 0',
    "approval_status" => "ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING'",
    'verification_code' => 'VARCHAR(32) NULL',
    'verification_expires_at' => 'DATETIME NULL',
    'verified_at' => 'DATETIME NULL',
    'approved_by_user_id' => 'INT NULL',
    'approved_at' => 'DATETIME NULL',
  ];

  foreach ($definitions as $column => $definition) {
    if (gcms_common_users_column_exists($pdo, $column)) {
      continue;
    }
    try {
      $pdo->exec("ALTER TABLE users ADD COLUMN $column $definition");
    } catch (Throwable $e) {
      // keep API usable even if schema cannot be altered here
    }
  }

  try {
    $pdo->exec('CREATE INDEX idx_users_approval_status ON users (approval_status)');
  } catch (Throwable $e) {
    // ignore duplicate/missing-column failures
  }

  try {
    $pdo->exec('CREATE INDEX idx_users_email_verified ON users (email_verified)');
  } catch (Throwable $e) {
    // ignore duplicate/missing-column failures
  }

  gcms_ensure_users_role_column($pdo);

  if (!gcms_common_table_exists($pdo, 'user_account_status')) {
    return;
  }

  $idCol = gcms_common_users_id_col($pdo);
  try {
    $pdo->exec(
      "UPDATE users u
       INNER JOIN user_account_status uas ON uas.user_id = u.$idCol
       SET
         u.email_verified = uas.email_verified,
         u.approval_status = uas.approval_status,
         u.verification_code = uas.verification_code,
         u.verification_expires_at = uas.verification_expires_at,
         u.verified_at = uas.verified_at,
         u.approved_by_user_id = uas.approved_by_user_id,
         u.approved_at = uas.approved_at"
    );
  } catch (Throwable $e) {
    // keep API usable even if legacy migration fails
  }
}

function gcms_ensure_users_archive_columns(PDO $pdo): void
{
  $definitions = [
    'is_archived' => 'TINYINT(1) NOT NULL DEFAULT 0',
    'archived_at' => 'DATETIME NULL',
    'archive_reason' => 'VARCHAR(120) NULL',
  ];

  foreach ($definitions as $column => $definition) {
    if (gcms_common_users_column_exists($pdo, $column)) {
      continue;
    }
    try {
      $pdo->exec("ALTER TABLE users ADD COLUMN $column $definition");
    } catch (Throwable $e) {
      // keep API usable even if schema cannot be altered here
    }
  }

  try {
    $pdo->exec('CREATE INDEX idx_users_is_archived ON users (is_archived)');
  } catch (Throwable $e) {
    // ignore duplicate/missing-column failures
  }
}

function gcms_ensure_users_profile_photo_column(PDO $pdo): void
{
  try {
    $stmt = $pdo->prepare(
      "SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME = 'profile_photo'
       LIMIT 1"
    );
    $stmt->execute();
    if ($stmt->fetchColumn() !== false) {
      return;
    }
  } catch (Throwable $e) {
    gcms_respond(500, ['ok' => false, 'message' => 'Failed to inspect users table schema.']);
  }

  try {
    $pdo->exec('ALTER TABLE users ADD COLUMN profile_photo LONGTEXT NULL');
  } catch (Throwable $e) {
    gcms_respond(500, ['ok' => false, 'message' => 'Failed to add profile_photo column.']);
  }
}
