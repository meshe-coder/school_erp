-- Preserve Step 1 auth and out-of-scope payment tables.
-- Replace only legacy empty school structure tables.
DROP TABLE IF EXISTS terms CASCADE;
DROP TABLE IF EXISTS academic_years CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;

CREATE TABLE academic_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(20) NOT NULL UNIQUE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_current  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date > start_date)
);
CREATE UNIQUE INDEX one_current_year ON academic_years (is_current) WHERE is_current;

CREATE TABLE terms (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  term_number      SMALLINT NOT NULL CHECK (term_number BETWEEN 1 AND 3),
  name             VARCHAR(30) NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  is_current       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date > start_date),
  UNIQUE (academic_year_id, term_number)
);
CREATE UNIQUE INDEX one_current_term ON terms (is_current) WHERE is_current;

CREATE TABLE grade_levels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(40) NOT NULL UNIQUE,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE classes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  grade_level_id   UUID NOT NULL REFERENCES grade_levels(id) ON DELETE RESTRICT,
  name             VARCHAR(60) NOT NULL,
  class_teacher_id UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (academic_year_id, name)
);
CREATE INDEX idx_classes_grade ON classes(grade_level_id);

CREATE TABLE teachers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  staff_number  VARCHAR(30) NOT NULL UNIQUE,
  first_name    VARCHAR(60) NOT NULL,
  last_name     VARCHAR(60) NOT NULL,
  phone         VARCHAR(12),
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','on_leave','left')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE classes
  ADD CONSTRAINT fk_classes_teacher
  FOREIGN KEY (class_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

CREATE TABLE students (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  admission_number  VARCHAR(30) NOT NULL UNIQUE,
  first_name        VARCHAR(60) NOT NULL,
  last_name         VARCHAR(60) NOT NULL,
  other_names       VARCHAR(100),
  date_of_birth     DATE,
  gender            VARCHAR(10) CHECK (gender IN ('male','female')),
  admission_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','graduated','transferred','suspended')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_name ON students(last_name, first_name);

CREATE TABLE guardians (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  full_name     VARCHAR(120) NOT NULL,
  relationship  VARCHAR(30) NOT NULL,
  phone         VARCHAR(12) NOT NULL,
  email         VARCHAR(255),
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_guardians_student ON guardians(student_id);
CREATE INDEX idx_guardians_phone ON guardians(phone);
CREATE UNIQUE INDEX one_primary_guardian ON guardians(student_id) WHERE is_primary;

CREATE TABLE enrollments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  status           VARCHAR(20) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','completed','withdrawn')),
  enrolled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, academic_year_id)
);
CREATE INDEX idx_enrollments_class ON enrollments(class_id);
