<?php
declare(strict_types=1);

require_once __DIR__ . '/_common.php';

function gcms_year_end_columns(PDO $pdo, string $table): array
{
  $stmt = $pdo->query("SHOW COLUMNS FROM `$table`");
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
  $cols = [];
  foreach ($rows as $row) {
    $name = strtolower((string)($row['Field'] ?? ''));
    if ($name !== '') {
      $cols[$name] = true;
    }
  }
  return $cols;
}

function gcms_require_student_role(PDO $pdo): void
{
  gcms_ensure_users_role_column($pdo);
  gcms_ensure_users_archive_columns($pdo);
}

$body = gcms_json_input();
$action = strtolower(trim((string)($body['action'] ?? '')));

try {
  $pdo = gcms_require_db();
  gcms_require_student_role($pdo);
  $cols = gcms_year_end_columns($pdo, 'users');
  $idCol = gcms_common_users_id_col($pdo);

  if ($action === 'promote_students') {
    $items = $body['items'] ?? [];
    if (!is_array($items) || count($items) === 0) {
      gcms_respond(400, ['ok' => false, 'message' => 'No students were selected for promotion.']);
    }

    $selectUser = $pdo->prepare(
      "SELECT $idCol AS id, role, college_id AS collegeId, COALESCE(is_archived, 0) AS isArchived
       FROM users
       WHERE $idCol = ?
       LIMIT 1"
    );
    $selectYearLevel = $pdo->prepare(
      'SELECT year_level_id AS id, college_id AS collegeId
       FROM year_levels
       WHERE year_level_id = ?
       LIMIT 1'
    );

    $updateSql = "UPDATE users SET year_level_id = ?, is_archived = 0, archived_at = NULL, archive_reason = NULL";
    if (isset($cols['updated_at'])) {
      $updateSql .= ', updated_at = NOW()';
    }
    $updateSql .= " WHERE $idCol = ?";
    $updateStmt = $pdo->prepare($updateSql);

    $pdo->beginTransaction();
    $promoted = 0;
    foreach ($items as $item) {
      if (!is_array($item)) {
        continue;
      }
      $userId = (int)($item['id'] ?? 0);
      $yearLevelId = (int)($item['yearLevelId'] ?? 0);
      if ($userId <= 0 || $yearLevelId <= 0) {
        continue;
      }

      $selectUser->execute([$userId]);
      $user = $selectUser->fetch(PDO::FETCH_ASSOC);
      if (!is_array($user)) {
        throw new RuntimeException('One of the selected students could not be found.');
      }
      if (strtoupper((string)($user['role'] ?? '')) !== 'STUDENT') {
        throw new RuntimeException('Only student users can be promoted.');
      }
      if ((int)($user['isArchived'] ?? 0) === 1) {
        throw new RuntimeException('Archived students cannot be promoted.');
      }

      $selectYearLevel->execute([$yearLevelId]);
      $yearLevel = $selectYearLevel->fetch(PDO::FETCH_ASSOC);
      if (!is_array($yearLevel)) {
        throw new RuntimeException('One of the target year levels does not exist.');
      }
      if ((int)($user['collegeId'] ?? 0) > 0 && (int)($yearLevel['collegeId'] ?? 0) !== (int)$user['collegeId']) {
        throw new RuntimeException('A selected year level does not match the student college.');
      }

      $updateStmt->execute([$yearLevelId, $userId]);
      $promoted += (int)$updateStmt->rowCount() > 0 ? 1 : 0;
    }
    $pdo->commit();

    gcms_respond(200, [
      'ok' => true,
      'promoted' => $promoted,
      'message' => $promoted . ' student(s) promoted successfully.',
    ]);
  }

  if ($action === 'archive_students') {
    $userIds = $body['userIds'] ?? [];
    if (!is_array($userIds) || count($userIds) === 0) {
      gcms_respond(400, ['ok' => false, 'message' => 'No students were selected for archiving.']);
    }

    $selectUser = $pdo->prepare(
      "SELECT $idCol AS id, role, COALESCE(is_archived, 0) AS isArchived
       FROM users
       WHERE $idCol = ?
       LIMIT 1"
    );

    $archiveSql = "UPDATE users SET is_archived = 1, archived_at = NOW(), archive_reason = 'GRADUATED'";
    if (isset($cols['updated_at'])) {
      $archiveSql .= ', updated_at = NOW()';
    }
    $archiveSql .= " WHERE $idCol = ?";
    $archiveStmt = $pdo->prepare($archiveSql);

    $pdo->beginTransaction();
    $archived = 0;
    foreach ($userIds as $rawUserId) {
      $userId = (int)$rawUserId;
      if ($userId <= 0) {
        continue;
      }

      $selectUser->execute([$userId]);
      $user = $selectUser->fetch(PDO::FETCH_ASSOC);
      if (!is_array($user)) {
        throw new RuntimeException('One of the selected students could not be found.');
      }
      if (strtoupper((string)($user['role'] ?? '')) !== 'STUDENT') {
        throw new RuntimeException('Only student users can be archived as graduates.');
      }
      if ((int)($user['isArchived'] ?? 0) === 1) {
        continue;
      }

      $archiveStmt->execute([$userId]);
      $archived += (int)$archiveStmt->rowCount() > 0 ? 1 : 0;
    }
    $pdo->commit();

    gcms_respond(200, [
      'ok' => true,
      'archived' => $archived,
      'message' => $archived . ' graduated student(s) archived successfully.',
    ]);
  }

  gcms_respond(400, ['ok' => false, 'message' => 'Invalid action.']);
} catch (Throwable $e) {
  if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  gcms_respond(500, ['ok' => false, 'message' => $e->getMessage()]);
}
