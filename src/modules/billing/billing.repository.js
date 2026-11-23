const db = require('../../config/db');

async function findTermById(termId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, academic_year_id AS "academicYearId", name,
            start_date AS "startDate", end_date AS "endDate",
            is_current AS "isCurrent"
       FROM terms WHERE id = $1`,
    [termId]
  );
  return result.rows[0] || null;
}

async function findStudentsForBillGeneration(termId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT s.id AS "studentId",
            s.admission_number AS "admissionNumber",
            c.id AS "classId",
            c.name AS "className",
            CASE
              WHEN sfo.id IS NOT NULL THEN sfo.amount
              WHEN cf.id IS NOT NULL THEN cf.amount
              ELSE NULL
            END::TEXT AS "effectiveFee",
            CASE
              WHEN sfo.id IS NOT NULL THEN 'override'
              WHEN cf.id IS NOT NULL THEN 'class'
              ELSE NULL
            END AS source
       FROM terms t
       JOIN enrollments e
         ON e.academic_year_id = t.academic_year_id
        AND e.status <> 'withdrawn'
       JOIN students s ON s.id = e.student_id
       JOIN classes c ON c.id = e.class_id
       LEFT JOIN class_fees cf ON cf.class_id = c.id AND cf.term_id = t.id
       LEFT JOIN student_fee_overrides sfo
         ON sfo.student_id = s.id AND sfo.term_id = t.id
      WHERE t.id = $1
      ORDER BY s.last_name, s.first_name`,
    [termId]
  );
  return result.rows;
}

async function findBill(studentId, termId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, student_id AS "studentId", term_id AS "termId",
            amount::TEXT AS amount, created_by AS "createdBy",
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM term_bills
      WHERE student_id = $1 AND term_id = $2`,
    [studentId, termId]
  );
  return result.rows[0] || null;
}

async function createBill(studentId, termId, amount, createdBy, client) {
  const executor = client || db;
  const result = await executor.query(
    `INSERT INTO term_bills (student_id, term_id, amount, created_by)
     VALUES ($1, $2, $3::NUMERIC(12,2), $4)
     RETURNING id, student_id AS "studentId", term_id AS "termId",
               amount::TEXT AS amount, created_by AS "createdBy"`,
    [studentId, termId, amount, createdBy]
  );
  return result.rows[0];
}

async function refreshBill(billId, amount, client) {
  const executor = client || db;
  const result = await executor.query(
    `UPDATE term_bills
        SET amount = $1::NUMERIC(12,2), updated_at = NOW()
      WHERE id = $2
      RETURNING id, student_id AS "studentId", term_id AS "termId",
                amount::TEXT AS amount, updated_at AS "updatedAt"`,
    [amount, billId]
  );
  return result.rows[0];
}

async function listTermBills(termId, filters, client) {
  const executor = client || db;
  const conditions = ['tb.term_id = $1'];
  const params = [termId];

  if (filters.classId) {
    params.push(filters.classId);
    conditions.push(`e.class_id = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const index = params.length;
    conditions.push(`(s.admission_number ILIKE $${index} OR s.first_name ILIKE $${index} OR s.last_name ILIKE $${index})`);
  }

  const whereClause = conditions.join(' AND ');
  const page = Number(filters.page) || 1;
  const limit = Math.min(Number(filters.limit) || 20, 100);
  params.push(limit);
  const limitIndex = params.length;
  params.push((page - 1) * limit);
  const offsetIndex = params.length;

  const data = await executor.query(
    `SELECT s.admission_number AS "admissionNumber",
            (s.first_name || ' ' || s.last_name) AS "fullName",
            c.name AS "className", tb.amount::TEXT AS amount
       FROM term_bills tb
       JOIN students s ON s.id = tb.student_id
       JOIN terms t ON t.id = tb.term_id
       LEFT JOIN enrollments e
         ON e.student_id = s.id
        AND e.academic_year_id = t.academic_year_id
        AND e.status <> 'withdrawn'
       LEFT JOIN classes c ON c.id = e.class_id
      WHERE ${whereClause}
      ORDER BY s.last_name, s.first_name
      LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );

  const countParams = params.slice(0, params.length - 2);
  const count = await executor.query(
    `SELECT COUNT(*)::INTEGER AS total
       FROM term_bills tb
       JOIN students s ON s.id = tb.student_id
       JOIN terms t ON t.id = tb.term_id
       LEFT JOIN enrollments e
         ON e.student_id = s.id
        AND e.academic_year_id = t.academic_year_id
        AND e.status <> 'withdrawn'
       LEFT JOIN classes c ON c.id = e.class_id
      WHERE ${whereClause}`,
    countParams
  );

  return { data: data.rows, page, limit, total: count.rows[0].total };
}

async function getStudentStatement(studentId, client) {
  const executor = client || db;

  const studentResult = await executor.query(
    `SELECT s.id, s.admission_number AS "admissionNumber",
            (s.first_name || ' ' || s.last_name) AS "name",
            c.id AS "classId", c.name AS "className"
       FROM students s
       LEFT JOIN enrollments e ON e.student_id = s.id
                              AND e.status = 'active'
       LEFT JOIN classes c ON c.id = e.class_id
      WHERE s.id = $1
      LIMIT 1`,
    [studentId]
  );

  const paidResult = await executor.query(
    `SELECT COALESCE(SUM(amount), 0)::NUMERIC(12,2)::TEXT AS "totalPaid"
       FROM payments
      WHERE student_id = $1 AND status = 'valid'`,
    [studentId]
  );

  const billedResult = await executor.query(
    `SELECT COALESCE(SUM(amount), 0)::NUMERIC(12,2)::TEXT AS "totalBilled"
       FROM term_bills
      WHERE student_id = $1`,
    [studentId]
  );

  const billResult = await executor.query(
    `WITH paid AS (
       SELECT COALESCE(SUM(amount), 0) AS total_paid
         FROM payments
        WHERE student_id = $1 AND status = 'valid'
     ), ordered AS (
       SELECT b.id, b.term_id AS "termId", t.name AS "termName",
              ay.name AS "yearName", t.start_date,
              b.amount,
              COALESCE(SUM(b.amount) OVER (
                ORDER BY t.start_date
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ), 0) AS billed_before
         FROM term_bills b
         JOIN terms t ON t.id = b.term_id
         JOIN academic_years ay ON ay.id = t.academic_year_id
        WHERE b.student_id = $1
     )
     SELECT o.*,
            LEAST(o.amount,
              GREATEST(0, p.total_paid - o.billed_before))::TEXT AS "paidAmount",
            (o.amount - LEAST(o.amount,
              GREATEST(0, p.total_paid - o.billed_before)))::TEXT AS remaining,
            CASE
              WHEN o.amount - LEAST(o.amount,
                   GREATEST(0, p.total_paid - o.billed_before)) = 0 THEN 'paid'
              WHEN LEAST(o.amount,
                   GREATEST(0, p.total_paid - o.billed_before)) = 0
                   AND o.amount > 0 THEN 'unpaid'
              ELSE 'partial'
            END AS status
       FROM ordered o CROSS JOIN paid p
      ORDER BY o.start_date`,
    [studentId]
  );

  const paymentResult = await executor.query(
    `SELECT id, amount::TEXT AS amount, method, reference,
            paid_at AS "paidAt", note, status,
            reversed_at AS "reversedAt", reverse_reason AS "reverseReason"
       FROM payments
      WHERE student_id = $1
      ORDER BY paid_at DESC, created_at DESC`,
    [studentId]
  );

  const totalBilled = billedResult.rows[0].totalBilled;
  const totalPaid = paidResult.rows[0].totalPaid;

  return {
    student: studentResult.rows[0] || null,
    bills: billResult.rows,
    payments: paymentResult.rows,
    totals: {
      totalBilled,
      totalPaid,
      balance: await db.query(
        `SELECT GREATEST(0,
          (COALESCE((SELECT SUM(amount) FROM term_bills WHERE student_id=$1),0) -
           COALESCE((SELECT SUM(amount) FROM payments WHERE student_id=$1 AND status='valid'),0)
          ))::NUMERIC(12,2)::TEXT AS balance`,
        [studentId]
      ).then((result) => result.rows[0].balance),
      credit: await db.query(
        `SELECT GREATEST(0,
          (COALESCE((SELECT SUM(amount) FROM payments WHERE student_id=$1 AND status='valid'),0) -
           COALESCE((SELECT SUM(amount) FROM term_bills WHERE student_id=$1),0)
          ))::NUMERIC(12,2)::TEXT AS credit`,
        [studentId]
      ).then((result) => result.rows[0].credit),
    },
  };
}

async function findStudentById(studentId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT s.id, s.admission_number AS "admissionNumber",
            (s.first_name || ' ' || s.last_name) AS "fullName"
       FROM students s WHERE s.id = $1`,
    [studentId]
  );
  return result.rows[0] || null;
}

async function findStudentByAdmissionNumber(admissionNumber, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT s.id, s.admission_number AS "admissionNumber",
            (s.first_name || ' ' || s.last_name) AS "fullName"
       FROM students s WHERE s.admission_number = $1`,
    [admissionNumber]
  );
  return result.rows[0] || null;
}

async function findDuplicateValidReference(method, reference, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id FROM payments
      WHERE method = $1
        AND status = 'valid'
        AND UPPER(reference) = UPPER($2)
      LIMIT 1`,
    [method, reference]
  );
  return result.rows[0] || null;
}

async function createPayment(fields, client) {
  const executor = client || db;
  const result = await executor.query(
    `INSERT INTO payments
       (student_id, amount, method, reference, paid_at, note, status, recorded_by)
     VALUES ($1, $2::NUMERIC(12,2), $3, $4, COALESCE($5::TIMESTAMPTZ, NOW()), $6, 'valid', $7)
     RETURNING id, student_id AS "studentId", amount::TEXT AS amount,
               method, reference, paid_at AS "paidAt", note, status,
               recorded_by AS "recordedBy", created_at AS "createdAt"`,
    [fields.studentId, fields.amount, fields.method,
     fields.reference || null, fields.paidAt || null,
     fields.note || null, fields.recordedBy]
  );
  return result.rows[0];
}

async function getPaymentTotals(studentId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT
       COALESCE((SELECT SUM(amount) FROM term_bills WHERE student_id = $1), 0)::NUMERIC(12,2)::TEXT AS "totalBilled",
       COALESCE((SELECT SUM(amount) FROM payments WHERE student_id = $1 AND status = 'valid'), 0)::NUMERIC(12,2)::TEXT AS "totalPaid",
       GREATEST(0,
         COALESCE((SELECT SUM(amount) FROM term_bills WHERE student_id = $1), 0) -
         COALESCE((SELECT SUM(amount) FROM payments WHERE student_id = $1 AND status = 'valid'), 0)
       )::NUMERIC(12,2)::TEXT AS balance,
       GREATEST(0,
         COALESCE((SELECT SUM(amount) FROM payments WHERE student_id = $1 AND status = 'valid'), 0) -
         COALESCE((SELECT SUM(amount) FROM term_bills WHERE student_id = $1), 0)
       )::NUMERIC(12,2)::TEXT AS credit`,
    [studentId]
  );
  return result.rows[0];
}

async function listPayments(filters, client) {
  const executor = client || db;
  const conditions = [];
  const params = [];

  if (filters.studentId) {
    params.push(filters.studentId);
    conditions.push(`p.student_id = $${params.length}`);
  }
  if (filters.method) {
    params.push(filters.method);
    conditions.push(`p.method = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`p.status = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    conditions.push(`p.paid_at >= $${params.length}::TIMESTAMPTZ`);
  }
  if (filters.to) {
    params.push(filters.to);
    conditions.push(`p.paid_at <= $${params.length}::TIMESTAMPTZ`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const index = params.length;
    conditions.push(`(s.admission_number ILIKE $${index} OR s.first_name ILIKE $${index} OR s.last_name ILIKE $${index} OR COALESCE(p.reference, '') ILIKE $${index})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const page = Number(filters.page) || 1;
  const limit = Math.min(Number(filters.limit) || 20, 100);
  params.push(limit);
  const limitIndex = params.length;
  params.push((page - 1) * limit);
  const offsetIndex = params.length;

  const data = await executor.query(
    `SELECT p.id, p.student_id AS "studentId",
            s.admission_number AS "admissionNumber",
            (s.first_name || ' ' || s.last_name) AS "studentName",
            c.name AS "className", p.amount::TEXT AS amount,
            p.method, p.reference, p.status,
            p.paid_at AS "paidAt", p.created_at AS "createdAt"
       FROM payments p
       JOIN students s ON s.id = p.student_id
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
       LEFT JOIN classes c ON c.id = e.class_id
       ${whereClause}
      ORDER BY p.paid_at DESC, p.created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );

  const countParams = params.slice(0, params.length - 2);
  const count = await executor.query(
    `SELECT COUNT(*)::INTEGER AS total
       FROM payments p
       JOIN students s ON s.id = p.student_id
       ${whereClause}`,
    countParams
  );

  return { data: data.rows, page, limit, total: count.rows[0].total };
}

async function findPaymentById(paymentId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, student_id AS "studentId", amount::TEXT AS amount,
            method, reference, paid_at AS "paidAt", status,
            reversed_at AS "reversedAt", reversed_by AS "reversedBy",
            reverse_reason AS "reverseReason"
       FROM payments WHERE id = $1`,
    [paymentId]
  );
  return result.rows[0] || null;
}

async function reversePayment(paymentId, reversedBy, reason, client) {
  const executor = client || db;
  const result = await executor.query(
    `UPDATE payments
        SET status = 'reversed', reversed_at = NOW(),
            reversed_by = $1, reverse_reason = $2
      WHERE id = $3 AND status = 'valid'
      RETURNING id, student_id AS "studentId", amount::TEXT AS amount,
                method, reference, status, reversed_at AS "reversedAt",
                reversed_by AS "reversedBy", reverse_reason AS "reverseReason"`,
    [reversedBy, reason, paymentId]
  );
  return result.rows[0] || null;
}

async function listBalances(filters, client) {
  const executor = client || db;
  const conditions = ['billed.student_id IS NOT NULL'];
  const params = [];

  if (filters.classId) {
    params.push(filters.classId);
    conditions.push(`active_class.class_id = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const index = params.length;
    conditions.push(`(s.admission_number ILIKE $${index} OR s.first_name ILIKE $${index} OR s.last_name ILIKE $${index})`);
  }

  const page = Number(filters.page) || 1;
  const limit = Math.min(Number(filters.limit) || 20, 100);

  const filteredCTE = `WITH billed AS (
       SELECT student_id, SUM(amount) AS total_billed
         FROM term_bills
        GROUP BY student_id
     ), paid AS (
       SELECT student_id, SUM(amount) AS total_paid
         FROM payments
        WHERE status = 'valid'
        GROUP BY student_id
     ), active_class AS (
       SELECT DISTINCT ON (student_id) student_id, class_id
         FROM enrollments
        WHERE status = 'active'
        ORDER BY student_id, enrolled_at DESC
     )
     SELECT s.id AS "studentId",
            s.admission_number AS "admissionNumber",
            (s.first_name || ' ' || s.last_name) AS "fullName",
            c.name AS "className",
            COALESCE(billed.total_billed, 0)::NUMERIC(12,2)::TEXT AS "totalBilled",
            COALESCE(paid.total_paid, 0)::NUMERIC(12,2)::TEXT AS "totalPaid",
            GREATEST(0, COALESCE(billed.total_billed, 0) - COALESCE(paid.total_paid, 0))::NUMERIC(12,2)::TEXT AS balance,
            GREATEST(0, COALESCE(paid.total_paid, 0) - COALESCE(billed.total_billed, 0))::NUMERIC(12,2)::TEXT AS credit
       FROM billed
       JOIN students s ON s.id = billed.student_id
       LEFT JOIN paid ON paid.student_id = billed.student_id
       LEFT JOIN active_class ON active_class.student_id = s.id
       LEFT JOIN classes c ON c.id = active_class.class_id
      WHERE ${conditions.join(' AND ')}`;

  if (filters.owing === 'true') {
    params.push('true');
  }

  const owingClause = filters.owing === 'true'
    ? `AND GREATEST(0, COALESCE(billed.total_billed, 0) - COALESCE(paid.total_paid, 0)) > 0`
    : '';

  const data = await executor.query(
    `WITH billed AS (
       SELECT student_id, SUM(amount) AS total_billed FROM term_bills GROUP BY student_id
     ), paid AS (
       SELECT student_id, SUM(amount) AS total_paid FROM payments WHERE status='valid' GROUP BY student_id
     ), active_class AS (
       SELECT DISTINCT ON (student_id) student_id, class_id FROM enrollments WHERE status='active' ORDER BY student_id, enrolled_at DESC
     )
     SELECT s.id AS "studentId", s.admission_number AS "admissionNumber",
            (s.first_name || ' ' || s.last_name) AS "fullName", c.name AS "className",
            COALESCE(billed.total_billed,0)::NUMERIC(12,2)::TEXT AS "totalBilled",
            COALESCE(paid.total_paid,0)::NUMERIC(12,2)::TEXT AS "totalPaid",
            GREATEST(0,COALESCE(billed.total_billed,0)-COALESCE(paid.total_paid,0))::NUMERIC(12,2)::TEXT AS balance,
            GREATEST(0,COALESCE(paid.total_paid,0)-COALESCE(billed.total_billed,0))::NUMERIC(12,2)::TEXT AS credit
       FROM billed
       JOIN students s ON s.id=billed.student_id
       LEFT JOIN paid ON paid.student_id=s.id
       LEFT JOIN active_class ON active_class.student_id=s.id
       LEFT JOIN classes c ON c.id=active_class.class_id
      WHERE ${conditions.join(' AND ').replace(/active_class\.class_id/g, 'active_class.class_id')}
            ${owingClause}
      ORDER BY balance DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );

  const countAndSummary = await executor.query(
    `WITH billed AS (
       SELECT student_id, SUM(amount) AS total_billed FROM term_bills GROUP BY student_id
     ), paid AS (
       SELECT student_id, SUM(amount) AS total_paid FROM payments WHERE status='valid' GROUP BY student_id
     ), active_class AS (
       SELECT DISTINCT ON (student_id) student_id, class_id FROM enrollments WHERE status='active' ORDER BY student_id, enrolled_at DESC
     ), filtered AS (
       SELECT s.id,
              COALESCE(billed.total_billed,0) AS total_billed,
              COALESCE(paid.total_paid,0) AS total_paid,
              GREATEST(0,COALESCE(billed.total_billed,0)-COALESCE(paid.total_paid,0)) AS balance
         FROM billed
         JOIN students s ON s.id=billed.student_id
         LEFT JOIN paid ON paid.student_id=s.id
         LEFT JOIN active_class ON active_class.student_id=s.id
         LEFT JOIN classes c ON c.id=active_class.class_id
        WHERE ${conditions.join(' AND ')} ${owingClause}
     )
     SELECT COUNT(*)::INTEGER AS "studentCount",
            COUNT(*) FILTER (WHERE balance > 0)::INTEGER AS "studentsOwing",
            COALESCE(SUM(total_billed),0)::NUMERIC(12,2)::TEXT AS "totalBilled",
            COALESCE(SUM(total_paid),0)::NUMERIC(12,2)::TEXT AS "totalPaid",
            COALESCE(SUM(balance),0)::NUMERIC(12,2)::TEXT AS "totalOutstanding"
       FROM filtered`,
    params
  );

  return {
    data: data.rows,
    page,
    limit,
    total: countAndSummary.rows[0].studentCount,
    summary: countAndSummary.rows[0],
  };
}

async function getDashboard(client) {
  const executor = client || db;

  const current = await executor.query(
    `SELECT ay.id AS "academicYearId", ay.name AS "academicYearName",
            t.id AS "termId", t.name AS "termName"
       FROM academic_years ay
       LEFT JOIN terms t ON t.academic_year_id=ay.id AND t.is_current=TRUE
      WHERE ay.is_current=TRUE LIMIT 1`
  );

  const totals = await executor.query(
    `WITH billed AS (
       SELECT student_id, SUM(amount) AS total_billed FROM term_bills GROUP BY student_id
     ), paid AS (
       SELECT student_id, SUM(amount) AS total_paid FROM payments WHERE status='valid' GROUP BY student_id
     ), student_totals AS (
       SELECT b.student_id,
              b.total_billed,
              COALESCE(p.total_paid,0) AS total_paid,
              GREATEST(0,b.total_billed-COALESCE(p.total_paid,0)) AS balance
         FROM billed b LEFT JOIN paid p ON p.student_id=b.student_id
     )
     SELECT COUNT(*)::INTEGER AS "studentCount",
            COALESCE(SUM(total_billed),0)::NUMERIC(12,2)::TEXT AS "totalBilled",
            COALESCE(SUM(total_paid),0)::NUMERIC(12,2)::TEXT AS "totalPaid",
            COALESCE(SUM(balance),0)::NUMERIC(12,2)::TEXT AS "totalOutstanding",
            COUNT(*) FILTER (WHERE balance=0)::INTEGER AS "studentsCleared",
            COUNT(*) FILTER (WHERE balance>0)::INTEGER AS "studentsOwing"
       FROM student_totals`
  );

  const recentPayments = await executor.query(
    `SELECT p.id, s.admission_number AS "admissionNumber",
            (s.first_name || ' ' || s.last_name) AS "studentName",
            p.amount::NUMERIC(12,2)::TEXT AS amount,
            p.method, p.paid_at AS "paidAt"
       FROM payments p JOIN students s ON s.id=p.student_id
      WHERE p.status='valid'
      ORDER BY p.paid_at DESC, p.created_at DESC
      LIMIT 10`
  );

  return {
    currentAcademicYear: current.rows[0]?.academicYearId ? current.rows[0] : null,
    ...totals.rows[0],
    recentPayments: recentPayments.rows,
  };
}

module.exports = {
  findTermById,
  findStudentsForBillGeneration,
  findBill,
  createBill,
  refreshBill,
  listTermBills,
  getStudentStatement,
  findStudentById,
  findStudentByAdmissionNumber,
  findDuplicateValidReference,
  createPayment,
  getPaymentTotals,
  listPayments,
  findPaymentById,
  reversePayment,
  listBalances,
  getDashboard,
};
