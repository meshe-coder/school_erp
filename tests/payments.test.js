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
  await db.query("DELETE FROM payments WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_PAY_%')");
  await db.query("DELETE FROM students WHERE admission_number LIKE 'TEST_PAY_%'");
  await db.query("DELETE FROM users WHERE username LIKE 'test_pay_%'");
});

afterAll(async () => {
  await db.query("DELETE FROM payments WHERE student_id IN (SELECT id FROM students WHERE admission_number LIKE 'TEST_PAY_%')");
  await db.query("DELETE FROM students WHERE admission_number LIKE 'TEST_PAY_%'");
  await db.query("DELETE FROM users WHERE username LIKE 'test_pay_%'");
  await db.pool.end();
});

async function createStudent(agent) {
  const user = await db.query(
    `INSERT INTO users (username, email, password_hash, role, is_active, must_change_password)
     VALUES ($1, $2, $3, 'student', TRUE, TRUE)
     ON CONFLICT (username) DO UPDATE SET is_active = TRUE
     RETURNING id`,
    ['test_pay_student', 'test_pay@example.com', '$2b$12$testdummyhash']
  );

  const student = await db.query(
    `INSERT INTO students (user_id, admission_number, first_name, last_name)
     VALUES ($1, $2, 'Test', 'PaymentStudent')
     ON CONFLICT (admission_number) DO UPDATE SET first_name = 'Test'
     RETURNING id, admission_number AS "admissionNumber"`,
    [user.rows[0].id, 'TEST_PAY_001']
  );

  return student.rows[0];
}

describe('Payments', () => {
  test('records by student id and admission number, validates selector and M-Pesa reference', async () => {
    const admin = await usersRepository.findByUsername(env.seedAdminUsername);
    await db.query("UPDATE users SET must_change_password = FALSE, is_active = TRUE, role = 'admin' WHERE id = $1", [admin.id]);

    const agent = request.agent(app);
    await loginAdmin(agent);
    const student = await createStudent(agent);

    const byId = await agent.post('/api/admin/payments').send({
      studentId: student.id,
      amount: '100.50',
      method: 'cash',
    });
    expect(byId.statusCode).toBe(201);
    expect(byId.body.payment.amount).toBe('100.50');

    const byAdmission = await agent.post('/api/admin/payments').send({
      admissionNumber: student.admissionNumber,
      amount: '50.00',
      method: 'bank',
      reference: 'BANK123',
    });
    expect(byAdmission.statusCode).toBe(201);

    const neither = await agent.post('/api/admin/payments').send({
      amount: '10.00',
      method: 'cash',
    });
    expect(neither.statusCode).toBe(400);

    const malformedMpesa = await agent.post('/api/admin/payments').send({
      studentId: student.id,
      amount: '10.00',
      method: 'mpesa',
      reference: 'bad',
    });
    expect(malformedMpesa.statusCode).toBe(400);
  });

  test('duplicate valid M-Pesa code is rejected, reversal allows reuse', async () => {
    const agent = request.agent(app);
    await loginAdmin(agent);
    const student = await createStudent(agent);

    await db.query('DELETE FROM payments WHERE student_id = $1', [student.id]);

    const first = await agent.post('/api/admin/payments').send({
      studentId: student.id,
      amount: '0.10',
      method: 'mpesa',
      reference: 'ABC1234567',
    });
    expect(first.statusCode).toBe(201);

    const duplicate = await agent.post('/api/admin/payments').send({
      studentId: student.id,
      amount: '0.20',
      method: 'mpesa',
      reference: 'abc1234567',
    });
    expect(duplicate.statusCode).toBe(409);

    const reversed = await agent
      .post(`/api/admin/payments/${first.body.payment.id}/reverse`)
      .send({ reason: 'TEST_PAY correction' });
    expect(reversed.statusCode).toBe(200);
    expect(reversed.body.totals.totalPaid).toBe('0.00');

    const second = await agent.post('/api/admin/payments').send({
      studentId: student.id,
      amount: '0.20',
      method: 'mpesa',
      reference: 'ABC1234567',
    });
    expect(second.statusCode).toBe(201);

    const again = await agent
      .post(`/api/admin/payments/${first.body.payment.id}/reverse`)
      .send({ reason: 'TEST_PAY duplicate reversal' });
    expect(again.statusCode).toBe(409);
  });

  test('payment list supports method/status filters', async () => {
    const agent = request.agent(app);
    await loginAdmin(agent);

    const result = await agent
      .get('/api/admin/payments?method=mpesa&status=valid&page=1&limit=20');

    expect(result.statusCode).toBe(200);
    expect(Array.isArray(result.body.data)).toBe(true);
  });
});
