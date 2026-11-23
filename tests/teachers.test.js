const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const env = require('../src/config/env');
const usersRepository = require('../src/modules/users/users.repository');

const prefix = 'TEST_T';

async function loginAdmin(agent) {
  await agent.post('/api/auth/login').send({
    username: env.seedAdminUsername,
    password: env.seedAdminPassword,
  });
}

beforeAll(async () => {
  await db.query("DELETE FROM teachers WHERE staff_number LIKE $1", [`${prefix}%`]);
  await db.query("DELETE FROM users WHERE username LIKE $1", [`${prefix.toLowerCase()}%`]);
});

afterAll(async () => {
  await db.query("DELETE FROM teachers WHERE staff_number LIKE $1", [`${prefix}%`]);
  await db.query("DELETE FROM users WHERE username LIKE $1", [`${prefix.toLowerCase()}%`]);
  await db.pool.end();
});

describe('Teachers', () => {
  test('admin creates teacher transactionally with temporary password', async () => {
    const admin = await usersRepository.findByUsername(env.seedAdminUsername);
    await db.query('UPDATE users SET must_change_password = FALSE, is_active = TRUE, role = \'admin\' WHERE id = $1', [admin.id]);

    const agent = request.agent(app);
    await loginAdmin(agent);

    const response = await agent.post('/api/admin/teachers').send({
      staffNumber: `${prefix}001`,
      firstName: 'Test',
      lastName: 'Teacher',
      phone: '0712345678',
      email: 'test.teacher@example.com',
    });

    expect(response.statusCode).toBe(201);
    expect(response.body.teacher.staffNumber).toBe(`${prefix}001`);
    expect(response.body.teacher.phone).toBe('254712345678');
    expect(response.body.temporaryPassword).toBeDefined();

    const login = await request(app).post('/api/auth/login').send({
      username: `${prefix}001`.toLowerCase(),
      password: response.body.temporaryPassword,
    });

    expect(login.statusCode).toBe(200);
    expect(login.body.user.must_change_password).toBe(true);
  });

  test('duplicate staff number returns 409', async () => {
    const agent = request.agent(app);
    await loginAdmin(agent);

    const response = await agent.post('/api/admin/teachers').send({
      staffNumber: `${prefix}001`,
      firstName: 'Duplicate',
      lastName: 'Teacher',
    });

    expect(response.statusCode).toBe(409);
  });

  test('teacher list and get return profiles', async () => {
    const agent = request.agent(app);
    await loginAdmin(agent);

    const list = await agent.get('/api/admin/teachers?status=active&search=TEST_T');
    expect(list.statusCode).toBe(200);

    const teacher = await agent.get('/api/admin/teachers');
    expect(teacher.statusCode).toBe(200);
  });
});
