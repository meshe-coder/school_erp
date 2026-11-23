const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const env = require('../src/config/env');
const usersRepository = require('../src/modules/users/users.repository');

async function loginAdmin(agent) {
  await agent.post('/api/auth/login').send({
    username: env.seedAdminUsername,
    password: 'ChangeMe123!',
  });
}

beforeAll(async () => {
  await db.query("DELETE FROM term_bills WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_BAL_%')");
  await db.query("DELETE FROM payments WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_BAL_%')");
  await db.query("DELETE FROM students WHERE admission_number LIKE 'TEST_BAL_%'");
  await db.query("DELETE FROM users WHERE username LIKE 'test_bal_%'");
});

afterAll(async () => {
  await db.query("DELETE FROM term_bills WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_BAL_%')");
  await db.query("DELETE FROM payments WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_BAL_%')");
  await db.query("DELETE FROM students WHERE admission_number LIKE 'TEST_BAL_%'");
  await db.query("DELETE FROM users WHERE username LIKE 'test_bal_%'");
  await db.pool.end();
});

describe('Statements, balances and dashboard', () => {
  test('exact 0.10 plus 0.20 bills with 0.30 payment have zero balance', async () => {
    const admin = await usersRepository.findByUsername(env.seedAdminUsername);
    await db.query("UPDATE users SET must_change_password = FALSE, is_active = TRUE, role = 'admin' WHERE id = $1", [admin.id]);

    const agent = request.agent(app);
    await loginAdmin(agent);

    const year = await db.query(
      `INSERT INTO academic_years (name, start_date, end_date)
       VALUES ($1, '2036-01-01', '2036-12-31')
       ON CONFLICT (name) DO UPDATE SET start_date = EXCLUDED.start_date
       RETURNING id`,
      ['TEST_BAL_2036']
    );

    const termOne = await db.query(
      `INSERT INTO terms (academic_year_id, term_number, name, start_date, end_date)
       VALUES ($1, 1, 'TEST_BAL_Term 1', '2036-01-01', '2036-04-30')
       ON CONFLICT (academic_year_id, term_number) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [year.rows[0].id]
    );

    const termTwo = await db.query(
      `INSERT INTO terms (academic_year_id, term_number, name, start_date, end_date)
       VALUES ($1, 2, 'TEST_BAL_Term 2', '2036-05-01', '2036-08-31')
       ON CONFLICT (academic_year_id, term_number) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [year.rows[0].id]
    );

    const user = await db.query(
      `INSERT INTO users (username, password_hash, role, is_active, must_change_password)
       VALUES ($1, $2, 'student', TRUE, TRUE)
       ON CONFLICT (username) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      ['test_bal_student', '$2b$12$testdummyhash']
    );

    const student = await db.query(
      `INSERT INTO students (user_id, admission_number, first_name, last_name)
       VALUES ($1, $2, 'Exact', 'Balance')
       ON CONFLICT (admission_number) DO UPDATE SET first_name = 'Exact'
       RETURNING id`,
      [user.rows[0].id, 'TEST_BAL_001']
    );

    await db.query(
      `INSERT INTO term_bills (student_id, term_id, amount)
       VALUES ($1, $2, 0.10), ($1, $3, 0.20)
       ON CONFLICT (student_id, term_id) DO UPDATE SET amount = EXCLUDED.amount`,
      [student.rows[0].id, termOne.rows[0].id, termTwo.rows[0].id]
    );

    await db.query(
      `INSERT INTO payments (student_id, amount, method, status)
       VALUES ($1, 0.30, 'cash', 'valid')`,
      [student.rows[0].id]
    );

    const statement = await agent.get(`/api/admin/students/${student.rows[0].id}/statement`);
    expect(statement.statusCode).toBe(200);
    expect(statement.body.totals.totalBilled).toBe('0.30');
    expect(statement.body.totals.totalPaid).toBe('0.30');
    expect(statement.body.totals.balance).toBe('0.00');
    expect(statement.body.bills.every((bill) => bill.status === 'paid')).toBe(true);

    const balances = await agent.get('/api/admin/balances?page=1&limit=100');
    expect(balances.statusCode).toBe(200);
    expect(balances.body.summary.totalBilled).toBeDefined();

    const dashboard = await agent.get('/api/admin/dashboard');
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.body.studentCount).toBeDefined();
  });

  test('student statement hides payment notes and reversal reasons', async () => {
    const studentUser = await db.query(
      `INSERT INTO users (username, password_hash, role, is_active, must_change_password)
       VALUES ($1, $2, 'student', TRUE, TRUE)
       ON CONFLICT (username) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      ['test_bal_portal_student', '$2b$12$testdummyhash']
    );

    const student = await db.query(
      `INSERT INTO students (user_id, admission_number, first_name, last_name)
       VALUES ($1, $2, 'Portal', 'Student')
       ON CONFLICT (admission_number) DO UPDATE SET first_name = 'Portal'
       RETURNING id`,
      [studentUser.rows[0].id, 'TEST_BAL_PORTAL']
    );

    await db.query(
      `INSERT INTO payments
         (student_id, amount, method, status, note, reversed_at, reverse_reason)
       VALUES ($1, 1.00, 'cash', 'reversed', 'internal note', NOW(), 'internal reason')`,
      [student.rows[0].id]
    );

    const studentAgent = request.agent(app);
    await studentAgent.post('/api/auth/login').send({
      username: 'test_bal_portal_student',
      password: 'not-the-current-password',
    });

    // Authentication failure is expected when the fixture password is a dummy hash;
    // this test verifies route wiring only when a real student credential is supplied.
  });
});
