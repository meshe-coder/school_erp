const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const env = require('../src/config/env');
const usersRepository = require('../src/modules/users/users.repository');

async function loginAdmin(agent) {
  await agent.post('/api/auth/login').send({
    username: env.seedAdminUsername,
    password: env.seedAdminPassword,
  });
}

beforeAll(async () => {
  await db.query("DELETE FROM term_bills WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_BILLS_%')");
  await db.query("DELETE FROM enrollments WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_BILLS_%')");
  await db.query("DELETE FROM class_fees WHERE class_id IN (SELECT id FROM classes WHERE name LIKE 'TEST_BILLS_%')");
  await db.query("DELETE FROM students WHERE admission_number LIKE 'TEST_BILLS_%'");
  await db.query("DELETE FROM users WHERE username LIKE 'test_bills_%'");
  await db.query("DELETE FROM classes WHERE name LIKE 'TEST_BILLS_%'");
  await db.query("DELETE FROM grade_levels WHERE name LIKE 'TEST_BILLS_%'");
  await db.query("DELETE FROM terms WHERE name LIKE 'TEST_BILLS_%'");
  await db.query("DELETE FROM academic_years WHERE name LIKE 'TEST_BILLS_%'");
});

afterAll(async () => {
  await db.query("DELETE FROM term_bills WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_BILLS_%')");
  await db.query("DELETE FROM enrollments WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_BILLS_%')");
  await db.query("DELETE FROM class_fees WHERE class_id IN (SELECT id FROM classes WHERE name LIKE 'TEST_BILLS_%')");
  await db.query("DELETE FROM students WHERE admission_number LIKE 'TEST_BILLS_%'");
  await db.query("DELETE FROM users WHERE username LIKE 'test_bills_%'");
  await db.query("DELETE FROM classes WHERE name LIKE 'TEST_BILLS_%'");
  await db.query("DELETE FROM grade_levels WHERE name LIKE 'TEST_BILLS_%'");
  await db.query("DELETE FROM terms WHERE name LIKE 'TEST_BILLS_%'");
  await db.query("DELETE FROM academic_years WHERE name LIKE 'TEST_BILLS_%'");
  await db.pool.end();
});

async function setupBillingFixture() {
  const year = await db.query(
    `INSERT INTO academic_years (name, start_date, end_date, is_current)
     VALUES ($1, '2035-01-01', '2035-12-31', TRUE)
     ON CONFLICT (name) DO UPDATE SET is_current = TRUE
     RETURNING id`,
    ['TEST_BILLS_2035']
  );

  await db.query('UPDATE academic_years SET is_current = FALSE WHERE id <> $1', [year.rows[0].id]);

  const term = await db.query(
    `INSERT INTO terms
       (academic_year_id, term_number, name, start_date, end_date, is_current)
     VALUES ($1, 1, $2, '2035-01-01', '2035-04-30', TRUE)
     ON CONFLICT (academic_year_id, term_number)
     DO UPDATE SET is_current = TRUE
     RETURNING id`,
    [year.rows[0].id, 'TEST_BILLS_Term 1']
  );

  await db.query('UPDATE terms SET is_current = FALSE WHERE id <> $1', [term.rows[0].id]);

  const level = await db.query(
    `INSERT INTO grade_levels (name, sort_order)
     VALUES ($1, 1) ON CONFLICT (name) DO UPDATE SET sort_order = 1
     RETURNING id`,
    ['TEST_BILLS_Form 1']
  );

  const schoolClass = await db.query(
    `INSERT INTO classes (academic_year_id, grade_level_id, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (academic_year_id, name) DO UPDATE SET grade_level_id = EXCLUDED.grade_level_id
     RETURNING id`,
    [year.rows[0].id, level.rows[0].id, 'TEST_BILLS_East']
  );

  await db.query(
    `INSERT INTO class_fees (class_id, term_id, amount)
     VALUES ($1, $2, 1000.00)
     ON CONFLICT (class_id, term_id) DO UPDATE SET amount = EXCLUDED.amount`,
    [schoolClass.rows[0].id, term.rows[0].id]
  );

  const user = await db.query(
    `INSERT INTO users (username, email, password_hash, role, is_active, must_change_password)
     VALUES ($1, $2, $3, 'student', TRUE, TRUE)
     ON CONFLICT (username) DO UPDATE SET is_active = TRUE
     RETURNING id`,
    ['test_bills_student', 'test_bills@example.com', '$2b$12$testdummyhash']
  );

  const student = await db.query(
    `INSERT INTO students (user_id, admission_number, first_name, last_name)
     VALUES ($1, $2, 'Test', 'BillsStudent')
     ON CONFLICT (admission_number) DO UPDATE SET first_name = 'Test'
     RETURNING id`,
    [user.rows[0].id, 'TEST_BILLS_001']
  );

  await db.query(
    `INSERT INTO enrollments (student_id, class_id, academic_year_id, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (student_id, academic_year_id)
     DO UPDATE SET class_id = EXCLUDED.class_id, status = 'active'`,
    [student.rows[0].id, schoolClass.rows[0].id, year.rows[0].id]
  );

  return { term: term.rows[0], schoolClass: schoolClass.rows[0], student: student.rows[0] };
}

describe('Bill generation and list', () => {
  test('creates one bill, rerun is unchanged, refresh updates amount', async () => {
    const admin = await usersRepository.findByUsername(env.seedAdminUsername);
    await db.query("UPDATE users SET must_change_password = FALSE, is_active = TRUE, role = 'admin' WHERE id = $1", [admin.id]);

    const agent = request.agent(app);
    await loginAdmin(agent);
    const fixture = await setupBillingFixture();

    const first = await agent
      .post(`/api/admin/terms/${fixture.term.id}/generate-bills`)
      .send({ refresh: false });

    expect(first.statusCode).toBe(200);
    expect(first.body.created).toBeGreaterThanOrEqual(1);

    const second = await agent
      .post(`/api/admin/terms/${fixture.term.id}/generate-bills`)
      .send({ refresh: false });

    expect(second.statusCode).toBe(200);
    expect(second.body.created).toBe(0);

    await db.query(
      'UPDATE class_fees SET amount = 1250.00, updated_at = NOW() WHERE class_id = $1 AND term_id = $2',
      [fixture.schoolClass.id, fixture.term.id]
    );

    const refreshed = await agent
      .post(`/api/admin/terms/${fixture.term.id}/generate-bills`)
      .send({ refresh: true });

    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.body.updated).toBeGreaterThanOrEqual(1);

    const bill = await db.query(
      'SELECT amount::TEXT AS amount FROM term_bills WHERE student_id = $1 AND term_id = $2',
      [fixture.student.id, fixture.term.id]
    );
    expect(bill.rows[0].amount).toBe('1250.00');

    const list = await agent.get(`/api/admin/terms/${fixture.term.id}/bills?page=1&limit=20`);
    expect(list.statusCode).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('unknown term returns 404', async () => {
    const agent = request.agent(app);
    await loginAdmin(agent);

    const response = await agent
      .post('/api/admin/terms/00000000-0000-0000-0000-000000000000/generate-bills')
      .send({ refresh: false });

    expect(response.statusCode).toBe(404);
  });
});
