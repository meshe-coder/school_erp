const db = require('../../config/db');

async function findByAdmissionNumber(admissionNumber, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, user_id AS "userId", admission_number AS "admissionNumber",
            first_name AS "firstName", last_name AS "lastName",
            other_names AS "otherNames", date_of_birth AS "dateOfBirth",
            gender, admission_date AS "admissionDate", status,
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM students WHERE admission_number = $1`,
    [admissionNumber]
  );
  return result.rows[0] || null;
}

async function findById(id, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT s.id, s.user_id AS "userId", s.admission_number AS "admissionNumber",
            s.first_name AS "firstName", s.last_name AS "lastName",
            s.other_names AS "otherNames", s.date_of_birth AS "dateOfBirth",
            s.gender, s.admission_date AS "admissionDate", s.status,
            s.created_at AS "createdAt", s.updated_at AS "updatedAt",
            u.username, u.email, u.is_active AS "isActive",
            u.must_change_password AS "mustChangePassword"
       FROM students s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findByUserId(userId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT s.id, s.user_id AS "userId", s.admission_number AS "admissionNumber",
            s.first_name AS "firstName", s.last_name AS "lastName",
            s.other_names AS "otherNames", s.date_of_birth AS "dateOfBirth",
            s.gender, s.admission_date AS "admissionDate", s.status,
            s.created_at AS "createdAt", s.updated_at AS "updatedAt"
       FROM students s WHERE s.user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function createStudent(fields, client) {
  const executor = client || db;
  const result = await executor.query(
    `INSERT INTO students
       (user_id, admission_number, first_name, last_name, other_names,
        date_of_birth, gender, admission_date, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::date, CURRENT_DATE), 'active')
     RETURNING id, user_id AS "userId", admission_number AS "admissionNumber",
               first_name AS "firstName", last_name AS "lastName",
               other_names AS "otherNames", date_of_birth AS "dateOfBirth",
               gender, admission_date AS "admissionDate", status,
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [fields.userId, fields.admissionNumber, fields.firstName, fields.lastName,
     fields.otherNames || null, fields.dateOfBirth || null,
     fields.gender || null, fields.admissionDate || null]
  );
  return result.rows[0];
}

async function listStudents(fields, client) {
  const executor = client || db;
  let page = Number(fields.page) || 1;
  let limit = Number(fields.limit) || 20;
  if (limit > 100) limit = 100;

  const conditions = [];
  const params = [];

  if (fields.status) {
    params.push(fields.status);
    conditions.push(`s.status = $${params.length}`);
  }
  if (fields.search) {
    params.push(`%${fields.search}%`);
    const index = params.length;
    conditions.push(`(s.admission_number ILIKE $${index} OR s.first_name ILIKE $${index} OR s.last_name ILIKE $${index})`);
  }
  if (fields.classId) {
    params.push(fields.classId);
    conditions.push(`e.class_id = $${params.length}`);
  }
  if (fields.gradeLevelId) {
    params.push(fields.gradeLevelId);
    conditions.push(`c.grade_level_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);
  const limitIndex = params.length;
  params.push((page - 1) * limit);
  const offsetIndex = params.length;

  const data = await executor.query(
    `SELECT s.id, s.admission_number AS "admissionNumber",
            s.first_name AS "firstName", s.last_name AS "lastName", s.status,
            c.id AS "classId", c.name AS "className",
            gl.name AS "gradeLevelName"
       FROM students s
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
       LEFT JOIN classes c ON c.id = e.class_id
       LEFT JOIN grade_levels gl ON gl.id = c.grade_level_id
       ${where}
      ORDER BY s.last_name, s.first_name
      LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );

  const countParams = params.slice(0, params.length - 2);
  const count = await executor.query(
    `SELECT COUNT(DISTINCT s.id)::INTEGER AS total
       FROM students s
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
       LEFT JOIN classes c ON c.id = e.class_id
       LEFT JOIN grade_levels gl ON gl.id = c.grade_level_id
       ${where}`,
    countParams
  );

  return { data: data.rows, page, limit, total: count.rows[0].total };
}

async function updateStudent(id, fields, client) {
  const executor = client || db;
  const assignments = [];
  const params = [];

  const mapping = {
    admissionNumber: 'admission_number',
    firstName: 'first_name',
    lastName: 'last_name',
    otherNames: 'other_names',
    dateOfBirth: 'date_of_birth',
    gender: 'gender',
    admissionDate: 'admission_date',
    status: 'status',
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (fields[key] !== undefined) {
      params.push(fields[key]);
      assignments.push(`${column} = $${params.length}`);
    }
  }

  assignments.push('updated_at = NOW()');
  params.push(id);

  const result = await executor.query(
    `UPDATE students SET ${assignments.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, user_id AS "userId", admission_number AS "admissionNumber",
                first_name AS "firstName", last_name AS "lastName",
                other_names AS "otherNames", date_of_birth AS "dateOfBirth",
                gender, admission_date AS "admissionDate", status,
                created_at AS "createdAt", updated_at AS "updatedAt"`,
    params
  );
  return result.rows[0] || null;
}

async function listGuardians(studentId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, student_id AS "studentId", full_name AS "fullName",
            relationship, phone, email, is_primary AS "isPrimary",
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM guardians WHERE student_id = $1
      ORDER BY is_primary DESC, created_at`,
    [studentId]
  );
  return result.rows;
}

async function addGuardian(studentId, fields, client) {
  const executor = client || db;
  const result = await executor.query(
    `INSERT INTO guardians
       (student_id, full_name, relationship, phone, email, is_primary)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, student_id AS "studentId", full_name AS "fullName",
               relationship, phone, email, is_primary AS "isPrimary",
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [studentId, fields.fullName, fields.relationship, fields.phone,
     fields.email || null, fields.isPrimary]
  );
  return result.rows[0];
}

async function demotePrimaryGuardian(studentId, client) {
  const executor = client || db;
  await executor.query(
    'UPDATE guardians SET is_primary = FALSE, updated_at = NOW() WHERE student_id = $1 AND is_primary = TRUE',
    [studentId]
  );
}

async function findGuardianById(id, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, student_id AS "studentId", full_name AS "fullName",
            relationship, phone, email, is_primary AS "isPrimary",
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM guardians WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function updateGuardian(id, fields, client) {
  const executor = client || db;
  const assignments = [];
  const params = [];

  const mapping = {
    fullName: 'full_name', relationship: 'relationship', phone: 'phone',
    email: 'email', isPrimary: 'is_primary',
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (fields[key] !== undefined) {
      params.push(fields[key]);
      assignments.push(`${column} = $${params.length}`);
    }
  }

  assignments.push('updated_at = NOW()');
  params.push(id);

  const result = await executor.query(
    `UPDATE guardians SET ${assignments.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, student_id AS "studentId", full_name AS "fullName",
                relationship, phone, email, is_primary AS "isPrimary",
                created_at AS "createdAt", updated_at AS "updatedAt"`,
    params
  );
  return result.rows[0] || null;
}

async function deleteGuardian(id, client) {
  const executor = client || db;
  await executor.query('DELETE FROM guardians WHERE id = $1', [id]);
}

async function findClassById(id, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT c.id, c.academic_year_id AS "academicYearId",
            c.grade_level_id AS "gradeLevelId", c.name,
            ay.name AS "academicYearName", gl.name AS "gradeLevelName"
       FROM classes c
       JOIN academic_years ay ON ay.id = c.academic_year_id
       JOIN grade_levels gl ON gl.id = c.grade_level_id
      WHERE c.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findActiveEnrollment(studentId, academicYearId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT id, student_id AS "studentId", class_id AS "classId",
            academic_year_id AS "academicYearId", status
       FROM enrollments
      WHERE student_id = $1 AND academic_year_id = $2 AND status = 'active'`,
    [studentId, academicYearId]
  );
  return result.rows[0] || null;
}

async function moveEnrollment(studentId, academicYearId, classId, client) {
  const executor = client || db;
  const result = await executor.query(
    `INSERT INTO enrollments (student_id, class_id, academic_year_id, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (student_id, academic_year_id)
     DO UPDATE SET class_id = EXCLUDED.class_id, status = 'active', enrolled_at = NOW()
     RETURNING id, student_id AS "studentId", class_id AS "classId",
               academic_year_id AS "academicYearId", status`,
    [studentId, classId, academicYearId]
  );
  return result.rows[0];
}

async function listEnrollmentHistory(studentId, client) {
  const executor = client || db;
  const result = await executor.query(
    `SELECT e.id, e.class_id AS "classId", c.name AS "className",
            e.academic_year_id AS "academicYearId", ay.name AS "academicYearName",
            e.status, e.enrolled_at AS "enrolledAt"
       FROM enrollments e
       JOIN classes c ON c.id = e.class_id
       JOIN academic_years ay ON ay.id = e.academic_year_id
      WHERE e.student_id = $1
      ORDER BY ay.start_date DESC, e.enrolled_at DESC`,
    [studentId]
  );
  return result.rows;
}

module.exports = {
  findByAdmissionNumber,
  findById,
  findByUserId,
  createStudent,
  listStudents,
  updateStudent,
  listGuardians,
  addGuardian,
  demotePrimaryGuardian,
  findGuardianById,
  updateGuardian,
  deleteGuardian,
  findClassById,
  findActiveEnrollment,
  moveEnrollment,
  listEnrollmentHistory,
};
