-- Tracks each STK push request sent to Safaricom Daraja
CREATE TABLE IF NOT EXISTS mpesa_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id VARCHAR(100) NOT NULL UNIQUE,
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE SET NULL,
  amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  phone               VARCHAR(30) NOT NULL,
  status              VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','cancelled')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mpesa_requests_checkout_id ON mpesa_requests(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_requests_student_id ON mpesa_requests(student_id);
