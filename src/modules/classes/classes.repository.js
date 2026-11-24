const db = require('../../config/db');

async function findGradeLevelById(id, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, name, sort_order AS "sortOrder", created_at AS "createdAt"
       FROM grade_levels WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findGradeLevelByName(name, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, name, sort_order AS "sortOrder", created_at AS "createdAt"
       FROM grade_levels WHERE LOWER(name) = LOWER($1)`,
    [name]
  );
  return result.rows[0] || null;
}

async function createGradeLevel({ name, sortOrder }, client) {
  const executor = client || db;
  const result = await executor.query(
    `INSERT INTO grade_levels (name, sort_order)
     VALUES ($1, $2)
     RETURNING id, name, sort_order AS "sortOrder", created_at AS "createdAt"`,
    [name, sortOrder]
  );
  return result.rows[0];
}

async function listGradeLevels(client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, name, sort_order AS "sortOrder", created_at AS "createdAt"
       FROM grade_levels
      ORDER BY sort_order ASC, name ASC`
  );
  return result.rows;
}

async function updateGradeLevel(id, fields, client) {
  const executor = client || db;
  const assignments = [];
  const params = [];

  if (fields.name !== undefined) {
    params.push(fields.name);
    assignments.push(`name = $${params.length}`);
  }
  if (fields.sortOrder !== undefined) {
    params.push(fields.sortOrder);
    assignments.push(`sort_order = $${params.length}`);
  }

  params.push(id);
  const result = await executor.query(
    `UPDATE grade_levels SET ${assignments.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, name, sort_order AS "sortOrder", created_at AS "createdAt"`,
    params
  );
  return result.rows[0] || null;
}

async function findAcademicYearById(id, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, name, start_date AS "startDate", end_date AS "endDate",
            is_current AS "isCurrent"
       FROM academic_years WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findCurrentAcademicYear(client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, name, start_date AS "startDate", end_date AS "endDate",
            is_current AS "isCurrent"
       FROM academic_years WHERE is_current = TRUE LIMIT 1`
  );
  return result.rows[0] || null;
}

async function findTeacherById(id, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, staff_number AS "staffNumber", first_name AS "firstName",
            last_name AS "lastName", status
       FROM teachers WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function createClass(fields, client) {
  const executor = client || db;
  const result = await executor.query(
    `INSERT INTO classes
       (academic_year_id, grade_level_id, name)
     VALUES ($1, $2, $3)
     RETURNING id, academic_year_id AS "academicYearId",
               grade_level_id AS "gradeLevelId", name,
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [fields.academicYearId, fields.gradeLevelId, fields.name]
  );
  return result.rows[0];
}

async function listClasses({ academicYearId, gradeLevelId }, client) {
  const executor = client || db;
  const conditions = [];
  const params = [];

  if (academicYearId) {
    params.push(academicYearId);
    conditions.push(`c.academic_year_id = $${params.length}`);
  }
  if (gradeLevelId) {
    params.push(gradeLevelId);
    conditions.push(`c.grade_level_id = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await executor.query(
    `SELECT c.id, c.academic_year_id AS "academicYearId",
            c.grade_level_id AS "gradeLevelId", c.name,
            c.created_at AS "createdAt", c.updated_at AS "updatedAt",
            gl.name AS "gradeLevelName",
            ay.name AS "academicYearName",
            COUNT(e.id)::INTEGER AS "studentCount"
       FROM classes c
       JOIN grade_levels gl ON gl.id = c.grade_level_id
       JOIN academic_years ay ON ay.id = c.academic_year_id
       LEFT JOIN enrollments e ON e.class_id = c.id AND e.status = 'active'
       ${whereClause}
      GROUP BY c.id, gl.name, gl.sort_order, ay.name, ay.start_date
      ORDER BY ay.start_date DESC, gl.sort_order ASC, c.name ASC`,
    params
  );
  return result.rows;
}

async function findClassById(id, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT c.id, c.academic_year_id AS "academicYearId",
            c.grade_level_id AS "gradeLevelId", c.name,
            c.created_at AS "createdAt", c.updated_at AS "updatedAt"
       FROM classes c WHERE c.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function updateClass(id, fields, client) {
  const executor = client || db;
  const assignments = [];
  const params = [];

  if (fields.name !== undefined) {
    params.push(fields.name);
    assignments.push(`name = $${params.length}`);
  }

  assignments.push('updated_at = NOW()');
  params.push(id);

  const result = await executor.query(
    `UPDATE classes SET ${assignments.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, academic_year_id AS "academicYearId",
                grade_level_id AS "gradeLevelId", name,
                created_at AS "createdAt", updated_at AS "updatedAt"`,
    params
  );
  return result.rows[0] || null;
}

async function countEnrollments(classId, client) {
  const executor = client || db;
  const result = await executor.query(
    'SELECT COUNT(*)::INTEGER AS count FROM enrollments WHERE class_id = $1',
    [classId]
  );
  return result.rows[0].count;
}

async function deleteClass(id, client) {
  const executor = client || db;
  await executor.query('DELETE FROM classes WHERE id = $1', [id]);
}

module.exports = {
  findGradeLevelById,
  findGradeLevelByName,
  createGradeLevel,
  listGradeLevels,
  updateGradeLevel,
  findAcademicYearById,
  findCurrentAcademicYear,
  findTeacherById,
  createClass,
  listClasses,
  findClassById,
  updateClass,
  countEnrollments,
  deleteClass,
};
