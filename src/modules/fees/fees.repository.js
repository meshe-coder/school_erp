const db = require('../../config/db');

async function findTermById(termId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, academic_year_id AS "academicYearId", term_number AS "termNumber",
            name, start_date AS "startDate", end_date AS "endDate",
            is_current AS "isCurrent"
       FROM terms WHERE id = $1`,
    [termId]
  );
  return result.rows[0] || null;
}

async function findCurrentTerm(client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, academic_year_id AS "academicYearId", term_number AS "termNumber",
            name, start_date AS "startDate", end_date AS "endDate",
            is_current AS "isCurrent"
       FROM terms WHERE is_current = TRUE LIMIT 1`
  );
  return result.rows[0] || null;
}

async function findClassForTerm(classId, academicYearId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, academic_year_id AS "academicYearId", name
       FROM classes
      WHERE id = $1 AND academic_year_id = $2`,
    [classId, academicYearId]
  );
  return result.rows[0] || null;
}

async function listClassFees(termId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT c.id AS "classId", c.name AS "className",
            gl.name AS "gradeLevelName",
            COUNT(DISTINCT e.student_id)::INTEGER AS "enrolledStudentCount",
            cf.amount::TEXT AS amount
       FROM terms t
       JOIN classes c ON c.academic_year_id = t.academic_year_id
       JOIN grade_levels gl ON gl.id = c.grade_level_id
       LEFT JOIN enrollments e ON e.class_id = c.id
                           AND e.academic_year_id = t.academic_year_id
                           AND e.status <> 'withdrawn'
       LEFT JOIN class_fees cf ON cf.class_id = c.id AND cf.term_id = t.id
      WHERE t.id = $1
      GROUP BY c.id, c.name, gl.name, gl.sort_order, cf.amount
      ORDER BY gl.sort_order ASC, c.name ASC`,
    [termId]
  );
  return result.rows;
}

async function upsertClassFee(termId, classId, amount, setBy, client) {
  const executor = client || db;
  const result = await executor.query(
    `INSERT INTO class_fees (class_id, term_id, amount, set_by)
     VALUES ($1, $2, $3::NUMERIC(12,2), $4)
     ON CONFLICT (class_id, term_id)
     DO UPDATE SET amount = EXCLUDED.amount,
                   set_by = EXCLUDED.set_by,
                   updated_at = NOW()
     RETURNING id, class_id AS "classId", term_id AS "termId",
               amount::TEXT AS amount, set_by AS "setBy"`,
    [classId, termId, amount, setBy]
  );
  return result.rows[0];
}

async function deleteClassFee(termId, classId, client) {
  const executor = client || db;
  const result = await executor.query(
    'DELETE FROM class_fees WHERE term_id = $1 AND class_id = $2 RETURNING id',
    [termId, classId]
  );
  return result.rows[0] || null;
}

async function findEffectiveFee(studentId, termId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT
       t.id AS "termId",
       c.id AS "classId",
       c.name AS "className",
       cf.amount::TEXT AS "classFee",
       sfo.amount::TEXT AS "overrideAmount",
       sfo.reason AS "overrideReason",
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
     JOIN students s ON s.id = $1
     LEFT JOIN enrollments e
       ON e.student_id = s.id
      AND e.academic_year_id = t.academic_year_id
      AND e.status <> 'withdrawn'
     LEFT JOIN classes c ON c.id = e.class_id
     LEFT JOIN class_fees cf ON cf.class_id = c.id AND cf.term_id = t.id
     LEFT JOIN student_fee_overrides sfo
       ON sfo.student_id = s.id AND sfo.term_id = t.id
     WHERE t.id = $2
     LIMIT 1`,
    [studentId, termId]
  );
  return result.rows[0] || null;
}

async function upsertOverride(studentId, termId, amount, reason, setBy, client) {
  const executor = client || db;
  const result = await executor.query(
    `INSERT INTO student_fee_overrides
       (student_id, term_id, amount, reason, set_by)
     VALUES ($1, $2, $3::NUMERIC(12,2), $4, $5)
     ON CONFLICT (student_id, term_id)
     DO UPDATE SET amount = EXCLUDED.amount,
                   reason = EXCLUDED.reason,
                   set_by = EXCLUDED.set_by,
                   updated_at = NOW()
     RETURNING id`,
    [studentId, termId, amount, reason, setBy]
  );
  return result.rows[0];
}

async function deleteOverride(studentId, termId, client) {
  const executor = client || db;
  const result = await executor.query(
    `DELETE FROM student_fee_overrides
      WHERE student_id = $1 AND term_id = $2
      RETURNING id`,
    [studentId, termId]
  );
  return result.rows[0] || null;
}

async function listStudentFees(termId, filters, client) {
  const executor = client || db;
  const conditions = ['e.academic_year_id = t.academic_year_id', "e.status <> 'withdrawn'"];
  const params = [termId];

  if (filters.classId) {
    params.push(filters.classId);
    conditions.push(`c.id = $${params.length}`);
  }

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const index = params.length;
    conditions.push(`(s.admission_number ILIKE $${index} OR s.first_name ILIKE $${index} OR s.last_name ILIKE $${index})`);
  }

  const effectiveExpression = `CASE
    WHEN sfo.id IS NOT NULL THEN sfo.amount
    WHEN cf.id IS NOT NULL THEN cf.amount
    ELSE NULL
  END`;
  const sourceExpression = `CASE
    WHEN sfo.id IS NOT NULL THEN 'override'
    WHEN cf.id IS NOT NULL THEN 'class'
    ELSE NULL
  END`;

  if (filters.missingFee === 'true') {
    conditions.push(`(${effectiveExpression}) IS NULL`);
  } else if (filters.missingFee === 'false') {
    conditions.push(`(${effectiveExpression}) IS NOT NULL`);
  }

  const whereClause = `t.id = $1 AND ${conditions.join(' AND ')}`;
  const page = Number(filters.page) || 1;
  const limit = Math.min(Number(filters.limit) || 20, 100);
  params.push(limit);
  const limitIndex = params.length;
  params.push((page - 1) * limit);
  const offsetIndex = params.length;

  const data = await executor.query(
    `SELECT s.id AS "studentId", s.admission_number AS "admissionNumber",
            (s.first_name || ' ' || s.last_name) AS "fullName",
            c.name AS "className",
            cf.amount::TEXT AS "classFee",
            sfo.amount::TEXT AS "overrideAmount",
            (${effectiveExpression})::TEXT AS "effectiveFee",
            ${sourceExpression} AS source
       FROM terms t
       JOIN enrollments e ON e.academic_year_id = t.academic_year_id
                          AND e.status <> 'withdrawn'
       JOIN students s ON s.id = e.student_id
       JOIN classes c ON c.id = e.class_id
       LEFT JOIN class_fees cf ON cf.class_id = c.id AND cf.term_id = t.id
       LEFT JOIN student_fee_overrides sfo ON sfo.student_id = s.id AND sfo.term_id = t.id
      WHERE ${whereClause}
      ORDER BY s.last_name, s.first_name
      LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );

  const countParams = params.slice(0, params.length - 2);
  const count = await executor.query(
    `SELECT COUNT(*)::INTEGER AS "studentCount"
       FROM terms t
       JOIN enrollments e ON e.academic_year_id = t.academic_year_id
                          AND e.status <> 'withdrawn'
       JOIN students s ON s.id = e.student_id
       JOIN classes c ON c.id = e.class_id
       LEFT JOIN class_fees cf ON cf.class_id = c.id AND cf.term_id = t.id
       LEFT JOIN student_fee_overrides sfo ON sfo.student_id = s.id AND sfo.term_id = t.id
      WHERE ${whereClause}`,
    countParams
  );

  const summary = await executor.query(
    `WITH matching_fees AS (
       SELECT s.id,
              (${effectiveExpression}) AS effective_fee
         FROM terms t
         JOIN enrollments e ON e.academic_year_id = t.academic_year_id
                            AND e.status <> 'withdrawn'
         JOIN students s ON s.id = e.student_id
         JOIN classes c ON c.id = e.class_id
         LEFT JOIN class_fees cf ON cf.class_id = c.id AND cf.term_id = t.id
         LEFT JOIN student_fee_overrides sfo ON sfo.student_id = s.id AND sfo.term_id = t.id
        WHERE ${whereClause}
     )
     SELECT COUNT(*)::INTEGER AS "studentCount",
            COUNT(*) FILTER (WHERE effective_fee IS NULL)::INTEGER AS "studentsWithoutFee",
            COALESCE(SUM(effective_fee), 0)::NUMERIC(12,2)::TEXT AS "expectedTotal"
       FROM matching_fees`,
    countParams
  );

  return {
    data: data.rows,
    page,
    limit,
    total: count.rows[0].studentCount,
    summary: summary.rows[0],
  };
}

module.exports = {
  findTermById,
  findCurrentTerm,
  findClassForTerm,
  listClassFees,
  upsertClassFee,
  deleteClassFee,
  findEffectiveFee,
  upsertOverride,
  deleteOverride,
  listStudentFees,
};
