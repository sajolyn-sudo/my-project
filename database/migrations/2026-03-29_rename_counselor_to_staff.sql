START TRANSACTION;

UPDATE user_type
SET user_type_name = 'STAFF'
WHERE UPPER(user_type_name) = 'COUNSELOR';

UPDATE users
SET role = 'STAFF'
WHERE UPPER(role) = 'COUNSELOR';

COMMIT;
