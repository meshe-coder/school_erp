CREATE TABLE class_fees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  term_id     UUID NOT NULL REFERENCES terms(id) ON DELETE RESTRICT,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  set_by      UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, term_id)
);

CREATE INDEX idx_class_fees_term ON class_fees(term_id);

CREATE TABLE student_fee_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  term_id     UUID NOT NULL REFERENCES terms(id) ON DELETE RESTRICT,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  reason      VARCHAR(255) NOT NULL,
  set_by      UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, term_id)
);

CREATE INDEX idx_overrides_term ON student_fee_overrides(term_id);
