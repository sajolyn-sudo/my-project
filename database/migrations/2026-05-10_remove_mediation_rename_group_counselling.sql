CREATE TABLE IF NOT EXISTS app_state (
  state_key VARCHAR(191) PRIMARY KEY,
  state_json LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DELETE FROM app_state
WHERE state_key = 'gcms_mock_mediation_cases_v1';

UPDATE app_state
SET state_json = REPLACE(
  REPLACE(state_json, 'Group Sessions', 'Group Counselling'),
  'Group session',
  'Group Counselling'
)
WHERE state_json LIKE '%Group Sessions%'
   OR state_json LIKE '%Group session%';
