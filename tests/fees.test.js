const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const env = require('../src/config/env');
const usersRepository = require('../src/modules/users/users.repository');

const prefix = 'TEST_FEES_';

async function loginAdmin(agent) {
  await agent.post('/api/auth/login').send({
    username: env.seedAdminUsername,
    password: env.seedAdminPassword,
  });
}

beforeAll(async () => {
  await db.query("DELETE FROM student_fee_overrides WHERE reason LIKE 'TEST_FEES_%'");
  await db.query("DELETE FROM class_fees WHERE class_id IN (SELECT id FROM classes WHERE name LIKE 'TEST_FEES_%')");
  await db.query("DELETE FROM enrollments WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_FEES_%')");
  await db.query("DELETE FROM guardians WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_FEES_%')");
  await db.query("DELETE FROM students WHERE admission_number LIKE 'TEST_FEES_%'");
  await db.query("DELETE FROM users WHERE username LIKE 'test_fees_%'");
  await db.query("DELETE FROM classes WHERE name LIKE 'TEST_FEES_%'");
  await db.query("DELETE FROM grade_levels WHERE name LIKE 'TEST_FEES_%'");
  await db.query("DELETE FROM terms WHERE name LIKE 'TEST_FEES_%'");
  await db.query("DELETE FROM academic_years WHERE name LIKE 'TEST_FEES_%'");
});

afterAll(async () => {
  await db.query("DELETE FROM student_fee_overrides WHERE reason LIKE 'TEST_FEES_%'");
  await db.query("DELETE FROM class_fees WHERE class_id IN (SELECT id FROM classes WHERE name LIKE 'TEST_FEES_%')");
  await db.query("DELETE FROM enrollments WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_FEES_%')");
  await db.query("DELETE FROM guardians WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_FEES_%')");
  await db.query("DELETE FROM students WHERE admission_number LIKE 'TEST_FEES_%'");
  await db.query("DELETE FROM users WHERE username LIKE 'test_fees_%'");
  await db.query("DELETE FROM classes WHERE name LIKE 'TEST_FEES_%'");
  await db.query("DELETE FROM grade_levels WHERE name LIKE 'TEST_FEES_%'");
  await db.query("DELETE FROM terms WHERE name LIKE 'TEST_FEES_%'");
  await db.query("DELETE FROM academic_years WHERE name LIKE 'TEST_FEES_%'");
  await db.pool.end();
});

async function setupFeeFixture(agent) {
  const year = await db.query(
    `INSERT INTO academic_years (name, start_date, end_date, is_current)
     VALUES ($1, '2034-01-01', '2034-12-31', TRUE)
     ON CONFLICT (name) DO UPDATE SET is_current = TRUE
     RETURNING id`,
    [`${prefix}2034`]
  );

  await db.query('UPDATE academic_years SET is_current = FALSE WHERE id <> $1', [year.rows[0].id]);

  const term = await db.query(
    `INSERT INTO terms
       (academic_year_id, term_number, name, start_date, end_date, is_current)
     VALUES ($1, 1, $2, '2034-01-01', '2034-04-30', TRUE)
     ON CONFLICT (academic_year_id, term_number)
     DO UPDATE SET is_current = TRUE
     RETURNING id`,
    [year.rows[0].id, `${prefix}Term 1`]
  );

  await db.query('UPDATE terms SET is_current = FALSE WHERE id <> $1', [term.rows[0].id]);

  const level = await db.query(
    `INSERT INTO grade_levels (name, sort_order)
     VALUES ($1, 1) ON CONFLICT (name) DO UPDATE SET sort_order = 1
     RETURNING id`,
    [`${prefix}Form 1`]
  );

  const schoolClass = await db.query(
    `INSERT INTO classes (academic_year_id, grade_level_id, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (academic_year_id, name) DO UPDATE SET grade_level_id = EXCLUDED.grade_level_id
     RETURNING id`,
    [year.rows[0].id, level.rows[0].id, `${prefix}East`]
  );

  const user = await db.query(
    `INSERT INTO users (username, email, password_hash, role, is_active, must_change_password)
     VALUES ($1, $2, $3, 'student', TRUE, TRUE)
     ON CONFLICT (username) DO UPDATE SET is_active = TRUE
     RETURNING id`,
    [`test_fees_student`, 'test_fees_student@example.com', '$2b$12$testdummyhash']
  );

  const student = await db.query(
    `INSERT INTO students (user_id, admission_number, first_name, last_name)
     VALUES ($1, $2, 'Test', 'FeesStudent')
     ON CONFLICT (admission_number) DO UPDATE SET first_name = 'Test'
     RETURNING id`,
    [user.rows[0].id, `${prefix}001`]
  );

  await db.query(
    `INSERT INTO enrollments (student_id, class_id, academic_year_id, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (student_id, academic_year_id)
     DO UPDATE SET class_id = EXCLUDED.class_id, status = 'active'`,
    [student.rows[0].id, schoolClass.rows[0].id, year.rows[0].id]
  );

  return {
    year,
    term: term.rows[0],
    schoolClass: schoolClass.rows[0],
    student: student.rows[0],
  };
}

describe('Class and student fees', () => {
  test('GET lists every class with null fee and PUT creates/updates fees transactionally', async () => {
    const admin = await usersRepository.findByUsername(env.seedAdminUsername);
    await db.query("UPDATE users SET must_change_password = FALSE, is_active = TRUE, role = 'admin' WHERE id = $1", [admin.id]);

    const agent = request.agent(app);
    await loginAdmin(agent);

    const fixture = await setupFeeFixture(agent);

    const initial = await agent.get(`/api/admin/terms/${fixture.term.id}/class-fees`);
    expect(initial.statusCode).toBe(200);
    expect(initial.body.data.length).toBeGreaterThan(0);
    expect(initial.body.data.find((item) => item.classId === fixture.schoolClass.id).amount).toBeNull();

    const put = await agent.put(`/api/admin/terms/${fixture.term.id}/class-fees`).send({
      fees: [{ classId: fixture.schoolClass.id, amount: '12000.5' }],
    });
    expect(put.statusCode).toBe(200);
    expect(put.body.data.find((item) => item.classId === fixture.schoolClass.id).amount).toBe('12000.50');

    const effective = await agent.get(`/api/admin/students/${fixture.student.id}/fee?termId=${fixture.term.id}`);
    expect(effective.statusCode).toBe(200);
    expect(effective.body.effectiveFee).toBe('12000.50');
    expect(effective.body.source).toBe('class');
  });

  test('override of zero works and DELETE restores class fee', async () => {
    const agent = request.agent(app);
    await loginAdmin(agent);

    const fixture = await setupFeeFixture(agent);
    await agent.put(`/api/admin/terms/${fixture.term.id}/class-fees`).send({
      fees: [{ classId: fixture.schoolClass.id, amount: '5000.00' }],
    });

    const overridden = await agent
      .put(`/api/admin/students/${fixture.student.id}/fee-override`)
      .send({ termId: fixture.term.id, amount: '0', reason: 'TEST_FEES sibling waiver' });

    expect(overridden.statusCode).toBe(200);
    expect(overridden.body.effectiveFee).toBe('0.00');
    expect(overridden.body.source).toBe('override');

    const removed = await agent
      .delete(`/api/admin/students/${fixture.student.id}/fee-override?termId=${fixture.term.id}`);

    expect(removed.statusCode).toBe(200);
    expect(removed.body.effectiveFee).toBe('5000.00');
    expect(removed.body.source).toBe('class');
  });

  test('overview returns exact decimal total and supports missingFee filter', async () => {
    const agent = request.agent(app);
    await loginAdmin(agent);

    const fixture = await setupFeeFixture(agent);

    await agent.put(`/api/admin/terms/${fixture.term.id}/class-fees`).send({
      fees: [{ classId: fixture.schoolClass.id, amount: '0.10' }],
    });

    const overview = await agent
      .get(`/api/admin/terms/${fixture.term.id}/student-fees?page=1&limit=20`);

    expect(overview.statusCode).toBe(200);
    expect(overview.body.summary.expectedTotal).toBe('0.10');

    const missing = await agent
      .get(`/api/admin/terms/${fixture.term.id}/student-fees?missingFee=true`);
    expect(missing.statusCode).toBe(200);
  });
});
