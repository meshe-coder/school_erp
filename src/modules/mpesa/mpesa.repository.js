const db = require('../../config/db');

/**
 * Repository for mpesa_requests table.
 */

async function createRequest(fields, client) {
  const executor = client || db;
  const result = await executor.query(
    `INSERT INTO mpesa_requests
       (checkout_request_id, student_id, amount, phone, status)
     VALUES ($1, $2, $3::NUMERIC(12,2), $4, $5)
     RETURNING id, checkout_request_id AS "checkoutRequestId",
               student_id AS "studentId", amount::TEXT AS amount,
               phone, status, created_at AS "createdAt"`,
    [
      fields.checkoutRequestId,
      fields.studentId,
      fields.amount,
      fields.phone,
      fields.status || 'pending',
    ]
  );
  return result.rows[0];
}

async function findByCheckoutId(checkoutRequestId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, checkout_request_id AS "checkoutRequestId",
            student_id AS "studentId", amount::TEXT AS amount,
            phone, status, created_at AS "createdAt"
       FROM mpesa_requests
      WHERE checkout_request_id = $1`,
    [checkoutRequestId]
  );
  return result.rows[0] || null;
}

async function updateStatus(checkoutRequestId, status, client) {
  const executor = client || db;
  const result = await executor.query(
    `UPDATE mpesa_requests
        SET status = $1
      WHERE checkout_request_id = $2
      RETURNING id, checkout_request_id AS "checkoutRequestId",
                student_id AS "studentId", amount::TEXT AS amount,
                phone, status, created_at AS "createdAt"`,
    [status, checkoutRequestId]
  );
  return result.rows[0] || null;
}

module.exports = {
  createRequest,
  findByCheckoutId,
  updateStatus,
};
