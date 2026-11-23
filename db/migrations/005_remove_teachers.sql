-- Remove teacher-specific class assignment before removing teacher profiles.
ALTER TABLE classes DROP CONSTRAINT IF EXISTS fk_classes_teacher;
ALTER TABLE classes DROP COLUMN IF EXISTS class_teacher_id;
DROP TABLE IF EXISTS teachers CASCADE;

-- Remove teacher logins. Current teacher rows have no profiles or dependents.
DELETE FROM users WHERE role = 'teacher';

-- This simpler edition supports administrators and students only.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'student'));
