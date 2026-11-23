const db = require('../../config/db');

const yearColumns = `
  id, name, start_date AS "startDate", end_date AS "endDate",
  is_current AS "isCurrent", created_at AS "createdAt", updated_at AS "updatedAt"
`;

const termColumns = `
  id, academic_year_id AS "academicYearId", term_number AS "termNumber",
  name, start_date AS "startDate", end_date AS "endDate",
  is_current AS "isCurrent", created_at AS "createdAt", updated_at AS "updatedAt"
`;

async function findYearById(id, client) {
  const executor = client || db;
  const result = await executor.query(`SELECT ${yearColumns} FROM academic_years WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function findYearByName(name, client) {
  const executor = client || db;
  const result = await executor.query(`SELECT ${yearColumns} FROM academic_years WHERE name = $1`, [name]);
  return result.rows[0] || null;
}

async function createYear({ name, startDate, endDate }, client) {
  const executor = client || db;
  const result = await executor.query(
    `INSERT INTO academic_years (name, start_date, end_date)
     VALUES ($1, $2, $3)
     RETURNING ${yearColumns}`,
    [name, startDate, endDate]
  );
  return result.rows[0];
}

async function listYears(client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT y.${yearColumns.replace(/,\s*/g, ', y.')}
     FROM academic_years y
     ORDER BY y.start_date DESC, y.name DESC`
  );

  const terms = await executor.query(
    `SELECT t.${termColumns.replace(/,\s*/g, ', t.')}
     FROM terms t
     WHERE t.academic_year_id = ANY($1::uuid[])
     ORDER BY t.term_number`,
    [result.rows.map((year) => year.id)]
  );

  return result.rows.map((year) => ({
    ...year,
    terms: terms.rows.filter((term) => term.academicYearId === year.id),
  }));
}

async function updateYear(id, fields, client) {
  const executor = client || db;
  const assignments = [];
  const params = [];

  if (fields.name !== undefined) {
    params.push(fields.name);
    assignments.push(`name = $${params.length}`);
  }
  if (fields.startDate !== undefined) {
    params.push(fields.startDate);
    assignments.push(`start_date = $${params.length}`);
  }
  if (fields.endDate !== undefined) {
    params.push(fields.endDate);
    assignments.push(`end_date = $${params.length}`);
  }

  assignments.push('updated_at = NOW()');
  params.push(id);

  const result = await executor.query(
    `UPDATE academic_years SET ${assignments.join(', ')}
     WHERE id = $${params.length}
     RETURNING ${yearColumns}`,
    params
  );
  return result.rows[0] || null;
}

async function setCurrentYear(id) {
  return db.withTransaction(async (client) => {
    await client.query('UPDATE academic_years SET is_current = FALSE, updated_at = NOW()');
    const result = await client.query(
      `UPDATE academic_years SET is_current = TRUE, updated_at = NOW()
       WHERE id = $1 RETURNING ${yearColumns}`,
      [id]
    );
    return result.rows[0] || null;
  });
}

async function findTermById(id, client) {
  const executor = client || db;
  const result = await executor.query(`SELECT ${termColumns} FROM terms WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function findTermByNumber(yearId, termNumber, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT ${termColumns} FROM terms
     WHERE academic_year_id = $1 AND term_number = $2`,
    [yearId, termNumber]
  );
  return result.rows[0] || null;
}

async function findOverlappingTerm(yearId, startDate, endDate, excludeId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT ${termColumns} FROM terms
     WHERE academic_year_id = $1
       AND ($2::date < end_date)
       AND (start_date < $3::date)
       AND ($4::uuid IS NULL OR id <> $4::uuid)
     LIMIT 1`,
    [yearId, startDate, endDate, excludeId || null]
  );
  return result.rows[0] || null;
}

async function createTerm(yearId, fields, client) {
  const executor = client || db;
  const result = await executor.query(
    `INSERT INTO terms
       (academic_year_id, term_number, name, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${termColumns}`,
    [yearId, fields.termNumber, fields.name, fields.startDate, fields.endDate]
  );
  return result.rows[0];
}

async function updateTerm(id, fields, client) {
  const executor = client || db;
  const assignments = [];
  const params = [];

  if (fields.termNumber !== undefined) {
    params.push(fields.termNumber);
    assignments.push(`term_number = $${params.length}`);
  }
  if (fields.name !== undefined) {
    params.push(fields.name);
    assignments.push(`name = $${params.length}`);
  }
  if (fields.startDate !== undefined) {
    params.push(fields.startDate);
    assignments.push(`start_date = $${params.length}`);
  }
  if (fields.endDate !== undefined) {
    params.push(fields.endDate);
    assignments.push(`end_date = $${params.length}`);
  }

  assignments.push('updated_at = NOW()');
  params.push(id);

  const result = await executor.query(
    `UPDATE terms SET ${assignments.join(', ')}
     WHERE id = $${params.length}
     RETURNING ${termColumns}`,
    params
  );
  return result.rows[0] || null;
}

async function setCurrentTerm(id) {
  return db.withTransaction(async (client) => {
    const term = await findTermById(id, client);
    if (!term) return null;

    const year = await findYearById(term.academicYearId, client);
    if (!year || !year.isCurrent) {
      const error = new Error('The term year must be the current academic year');
      error.statusCode = 409;
      throw error;
    }

    await client.query('UPDATE terms SET is_current = FALSE, updated_at = NOW()');
    const result = await client.query(
      `UPDATE terms SET is_current = TRUE, updated_at = NOW()
       WHERE id = $1 RETURNING ${termColumns}`,
      [id]
    );
    return result.rows[0];
  });
}

async function getCurrentAcademic(client) {
  const executor = client || db;
  const yearResult = await executor.query(
    `SELECT ${yearColumns} FROM academic_years WHERE is_current = TRUE LIMIT 1`
  );
  const termResult = await executor.query(
    `SELECT ${termColumns} FROM terms WHERE is_current = TRUE LIMIT 1`
  );

  return {
    academicYear: yearResult.rows[0] || null,
    term: termResult.rows[0] || null,
  };
}

module.exports = {
  findYearById,
  findYearByName,
  createYear,
  listYears,
  updateYear,
  setCurrentYear,
  findTermById,
  findTermByNumber,
  findOverlappingTerm,
  createTerm,
  updateTerm,
  setCurrentTerm,
  getCurrentAcademic,
};
