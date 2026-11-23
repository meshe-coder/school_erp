DROP TABLE IF EXISTS payment_allocations CASCADE;
DROP TABLE IF EXISTS payments CASCADE;

CREATE TABLE term_bills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  term_id     UUID NOT NULL REFERENCES terms(id) ON DELETE RESTRICT,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, term_id)
);

CREATE INDEX idx_term_bills_term ON term_bills(term_id);

CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method          VARCHAR(10) NOT NULL
                  CHECK (method IN ('cash','mpesa','bank','other')),
  reference       VARCHAR(60),
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note            VARCHAR(255),
  status          VARCHAR(10) NOT NULL DEFAULT 'valid'
                  CHECK (status IN ('valid','reversed')),
  recorded_by     UUID REFERENCES users(id),
  reversed_at     TIMESTAMPTZ,
  reversed_by     UUID REFERENCES users(id),
  reverse_reason  VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_student ON payments(student_id);
CREATE INDEX idx_payments_paid_at ON payments(paid_at);

CREATE UNIQUE INDEX uq_payments_reference
  ON payments (method, UPPER(reference))
  WHERE reference IS NOT NULL AND status = 'valid';
