const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const env = require('../src/config/env');
const usersRepository = require('../src/modules/users/users.repository');

const prefix = 'TEST_STUDENT_';

async function loginAdmin(agent) {
  await agent.post('/api/auth/login').send({
    username: env.seedAdminUsername,
    password: env.seedAdminPassword,
  });
}

beforeAll(async () => {
  await db.query("DELETE FROM enrollments WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE $1)", [`${prefix}%`]);
  await db.query("DELETE FROM guardians WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE $1)", [`${prefix}%`]);
  await db.query("DELETE FROM students WHERE admission_number LIKE $1", [`${prefix}%`]);
  await db.query("DELETE FROM users WHERE username LIKE $1", [`${prefix.toLowerCase()}%`]);
  await db.query("DELETE FROM classes WHERE name LIKE 'TEST_STUDENT_%'");
  await db.query("DELETE FROM grade_levels WHERE name LIKE 'TEST_STUDENT_%'");
  await db.query("DELETE FROM academic_years WHERE name LIKE 'TEST_STUDENT_%'");
});

afterAll(async () => {
  await db.query("DELETE FROM enrollments WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE $1)", [`${prefix}%`]);
  await db.query("DELETE FROM guardians WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE $1)", [`${prefix}%`]);
  await db.query("DELETE FROM students WHERE admission_number LIKE $1", [`${prefix}%`]);
  await db.query("DELETE FROM users WHERE username LIKE $1", [`${prefix.toLowerCase()}%`]);
  await db.query("DELETE FROM classes WHERE name LIKE 'TEST_STUDENT_%'");
  await db.query("DELETE FROM grade_levels WHERE name LIKE 'TEST_STUDENT_%'");
  await db.query("DELETE FROM academic_years WHERE name LIKE 'TEST_STUDENT_%'");
  await db.pool.end();
});

describe('Students', () => {
  test('creates student with two guardians and does not leak password hash', async () => {
    const admin = await usersRepository.findByUsername(env.seedAdminUsername);
    await db.query(
      "UPDATE users SET must_change_password = FALSE, is_active = TRUE, role = 'admin' WHERE id = $1",
      [admin.id]
    );

    const year = await db.query(
      `INSERT INTO academic_years (name, start_date, end_date)
       VALUES ($1, '2032-01-01', '2032-12-31') RETURNING id`,
      [`TEST_STUDENT_2032`]
    );
    const level = await db.query(
      `INSERT INTO grade_levels (name, sort_order)
       VALUES ($1, 1) RETURNING id`,
      [`TEST_STUDENT_Form 1`]
    );
    const schoolClass = await db.query(
      `INSERT INTO classes (academic_year_id, grade_level_id, name)
       VALUES ($1, $2, $3) RETURNING id`,
      [year.rows[0].id, level.rows[0].id, `${prefix}East`]
    );

    const agent = request.agent(app);
    await loginAdmin(agent);

    const response = await agent.post('/api/admin/students').send({
      admissionNumber: `${prefix}001`,
      firstName: 'Test',
      lastName: 'Student',
      gender: 'male',
      guardians: [
        {
          fullName: 'Primary Guardian',
          relationship: 'mother',
          phone: '0712345678',
          isPrimary: true,
        },
        {
          fullName: 'Secondary Guardian',
          relationship: 'father',
          phone: '0112345678',
          isPrimary: false,
        },
      ],
      classId: schoolClass.rows[0].id,
    });

    expect(response.statusCode).toBe(201);
    expect(response.body.student.admissionNumber).toBe(`${prefix}001`);
    expect(response.body.guardians).toHaveLength(2);
    expect(response.body.guardians[0].phone).toBe('254712345678');
    expect(response.body.temporaryPassword).toBeDefined();
    expect(JSON.stringify(response.body)).not.toContain('password_hash');

    const login = await request(app).post('/api/auth/login').send({
      username: `${prefix}001`.toLowerCase(),
      password: response.body.temporaryPassword,
    });

    expect(login.statusCode).toBe(200);
    expect(login.body.user.must_change_password).toBe(true);

    await db.query("DELETE FROM enrollments WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_STUDENT_%')");
    await db.query("DELETE FROM guardians WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_STUDENT_%')");
    await db.query("DELETE FROM students WHERE admission_number LIKE 'TEST_STUDENT_%'");
    await db.query("DELETE FROM users WHERE username LIKE 'test_student_%'");
  });

  test('duplicate admission number leaves no orphan user', async () => {
    const agent = request.agent(app);
    await loginAdmin(agent);

    const first = await agent.post('/api/admin/students').send({
      admissionNumber: `${prefix}001`,
      firstName: 'Another',
      lastName: 'Student',
    });

    expect(first.statusCode).toBe(201);

    const before = await db.query(
      "SELECT COUNT(*)::INTEGER AS count FROM users WHERE username LIKE $1",
      [`${prefix.toLowerCase()}%`]
    );

    const duplicate = await agent.post('/api/admin/students').send({
      admissionNumber: `${prefix}001`,
      firstName: 'Another',
      lastName: 'Student',
    });

    const after = await db.query(
      "SELECT COUNT(*)::INTEGER AS count FROM users WHERE username LIKE $1",
      [`${prefix.toLowerCase()}%`]
    );

    expect(duplicate.statusCode).toBe(409);
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });

  test('enrolling in a second class moves the existing enrollment', async () => {
    const agent = request.agent(app);
    await loginAdmin(agent);

    const studentResult = await db.query(
      `INSERT INTO users (username,email,password_hash,role,is_active,must_change_password)
       VALUES ($1,$2,$3,'student',TRUE,TRUE) RETURNING id`,
      [`${prefix.toLowerCase()}move`, 'move@example.com', '$2b$12$testdummyhash']
    );
    const student = await db.query(
      `INSERT INTO students (user_id, admission_number, first_name, last_name)
       VALUES ($1,$2,'Move','Student') RETURNING id`,
      [studentResult.rows[0].id, `${prefix}MOVE`]
    );

    const year = await db.query(
      `INSERT INTO academic_years (name,start_date,end_date)
       VALUES ($1,'2033-01-01','2033-12-31') RETURNING id`,
      [`TEST_STUDENT_2033`]
    );
    const level = await db.query(
      `INSERT INTO grade_levels (name,sort_order) VALUES ($1,1) RETURNING id`,
      [`TEST_STUDENT_MoveLevel`]
    );
    const classes = await db.query(
      `INSERT INTO classes (academic_year_id,grade_level_id,name)
       VALUES ($1,$2,$3),($1,$2,$4) RETURNING id,name`,
      [year.rows[0].id, level.rows[0].id, `${prefix}A`, `${prefix}B`]
    );

    await agent.post(`/api/admin/students/${student.rows[0].id}/enroll`).send({ classId: classes.rows[0].id });
    const moved = await agent.post(`/api/admin/students/${student.rows[0].id}/enroll`).send({ classId: classes.rows[1].id });

    expect(moved.statusCode).toBe(200);

    const enrollmentCount = await db.query(
      `SELECT COUNT(*)::INTEGER AS count FROM enrollments
       WHERE student_id = $1 AND academic_year_id = $2`,
      [student.rows[0].id, year.rows[0].id]
    );
    expect(enrollmentCount.rows[0].count).toBe(1);

    await db.query('DELETE FROM students WHERE id = $1', [student.rows[0].id]);
    await db.query('DELETE FROM users WHERE id = $1', [studentResult.rows[0].id]);
  });
});
