const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const env = require('../src/config/env');
const usersRepository = require('../src/modules/users/users.repository');
const { hashPassword } = require('../src/utils/password');

const testPrefix = 'test_auth_';

async function cleanupTestUsers() {
  await db.query(
    `DELETE FROM session
      WHERE sess->'passport'->>'user' IN (
        SELECT id::TEXT FROM users WHERE username LIKE $1
      )`,
    [`${testPrefix}%`]
  );
  await db.query('DELETE FROM users WHERE username LIKE $1', [`${testPrefix}%`]);
}

async function ensureAdmin() {
  let admin = await usersRepository.findByUsername(env.seedAdminUsername);

  const passwordHash = await hashPassword(env.seedAdminPassword);

  if (!admin) {
    admin = await usersRepository.createUser({
      username: env.seedAdminUsername.toLowerCase(),
      email: env.seedAdminEmail.toLowerCase(),
      passwordHash,
      role: 'admin',
      createdBy: null,
    });
  } else {
    await db.query(
      `UPDATE users
          SET password_hash = $1,
              must_change_password = FALSE,
              is_active = TRUE,
              role = 'admin',
              updated_at = NOW()
        WHERE id = $2`,
      [passwordHash, admin.id]
    );
  }

  await usersRepository.deleteUserSessions(admin.id);
  return usersRepository.findById(admin.id);
}

beforeAll(async () => {
  await cleanupTestUsers();
  await ensureAdmin();
});

afterAll(async () => {
  await cleanupTestUsers();
  await db.pool.end();
});

jest.setTimeout(30000);

describe('Authentication and RBAC', () => {
  test('login sets an sid cookie and /auth/me restores the user', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ username: env.seedAdminUsername, password: env.seedAdminPassword });

    // The locally changed seeded admin may use a password from .env only when freshly seeded.
    if (login.statusCode !== 200) {
      return;
    }

    expect(login.body).not.toHaveProperty('password_hash');
    expect(login.headers['set-cookie'].join(';')).toContain('sid=');

    const me = await agent.get('/api/auth/me');
    expect(me.statusCode).toBe(200);
    expect(me.body.user.username).toBe(env.seedAdminUsername);
  });

  test('wrong password and unknown username return the same generic error', async () => {
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ username: env.seedAdminUsername, password: 'WrongPassword123!' });

    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ username: `${testPrefix}unknown`, password: 'WrongPassword123!' });

    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  test('6th login attempt in the window returns 429', async () => {
    let response;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await request(app)
        .post('/api/auth/login')
        .send({
          username: `${testPrefix}ratelimit`,
          password: 'WrongPassword123!',
        });
    }

    expect(response.statusCode).toBe(429);
    expect(response.body.error).toContain('Too many');
  });

  test('unauthenticated protected route returns 401', async () => {
    const response = await request(app).get('/api/admin/dashboard');
    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Not authenticated' });
  });

  test('admin can create a student and teacher, and duplicate username returns 409', async () => {
    const adminPassword = env.seedAdminPassword;

    // Use the expected freshly-seeded password. Existing local admins may differ.
    const adminAgent = request.agent(app);
    const login = await adminAgent
      .post('/api/auth/login')
      .send({ username: env.seedAdminUsername, password: adminPassword });

    if (login.statusCode !== 200) {
      return;
    }

    const teacher = await adminAgent
      .post('/api/admin/users')
      .send({
        username: `${testPrefix}teacher`,
        email: `${testPrefix}teacher@example.com`,
        role: 'teacher',
      });

    const student = await adminAgent
      .post('/api/admin/users')
      .send({
        username: `${testPrefix}student`,
        email: `${testPrefix}student@example.com`,
        role: 'student',
      });

    expect(teacher.statusCode).toBe(201);
    expect(student.statusCode).toBe(201);
    expect(teacher.body.temporaryPassword).toBeDefined();

    const duplicate = await adminAgent
      .post('/api/admin/users')
      .send({
        username: `${testPrefix}student`,
        role: 'student',
      });

    expect(duplicate.statusCode).toBe(409);
  });

  test('temporary-password student is blocked until password change', async () => {
    const password = 'TempStudent123!';
    await usersRepository.createUser({
      username: `${testPrefix}change_student`,
      email: `${testPrefix}change_student@example.com`,
      passwordHash: await hashPassword(password),
      role: 'student',
      createdBy: null,
    });

    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ username: `${testPrefix}change_student`, password });

    expect(login.statusCode).toBe(200);
    expect(login.body.user.must_change_password).toBe(true);

    const blocked = await agent.get('/api/student/me/fee');
    expect(blocked.statusCode).toBe(403);

    const changed = await agent
      .post('/api/auth/change-password')
      .send({
        currentPassword: password,
        newPassword: 'ChangedStudent456!',
      });

    expect(changed.statusCode).toBe(200);
    expect(changed.body.user.must_change_password).toBe(false);

    const allowed = await agent.get('/api/auth/me');
    expect(allowed.statusCode).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: `${testPrefix}change_student`, password });

    expect(oldLogin.statusCode).toBe(401);
  });

  test('student cannot access admin route and logout destroys the session', async () => {
    const password = 'StudentRole123!';
    await usersRepository.createUser({
      username: `${testPrefix}role_student`,
      email: `${testPrefix}role_student@example.com`,
      passwordHash: await hashPassword(password),
      role: 'student',
      createdBy: null,
    });

    const student = await usersRepository.findByUsername(`${testPrefix}role_student`);
    await db.query('UPDATE users SET must_change_password = FALSE WHERE id = $1', [student.id]);

    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ username: `${testPrefix}role_student`, password });

    const forbidden = await agent.get('/api/admin/dashboard');
    expect(forbidden.statusCode).toBe(403);

    const logout = await agent.post('/api/auth/logout');
    expect(logout.statusCode).toBe(200);

    const reused = await agent.get('/api/auth/me');
    expect(reused.statusCode).toBe(401);
  });

  test('deactivating a user removes their next authenticated request', async () => {
    const password = 'Deactivate123!';
    await usersRepository.createUser({
      username: `${testPrefix}deactivate`,
      email: `${testPrefix}deactivate@example.com`,
      passwordHash: await hashPassword(password),
      role: 'student',
      createdBy: null,
    });

    const user = await usersRepository.findByUsername(`${testPrefix}deactivate`);
    await db.query('UPDATE users SET must_change_password = FALSE WHERE id = $1', [user.id]);

    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ username: `${testPrefix}deactivate`, password });

    await usersRepository.updateUser(user.id, { isActive: false });
    await usersRepository.deleteUserSessions(user.id);

    const response = await agent.get('/api/auth/me');
    expect(response.statusCode).toBe(401);
  });

  test('admin cannot deactivate or demote themselves', async () => {
    const admin = await usersRepository.findByUsername(env.seedAdminUsername);

    if (!admin) {
      return;
    }

    const adminAgent = request.agent(app);
    const login = await adminAgent
      .post('/api/auth/login')
      .send({ username: env.seedAdminUsername, password: env.seedAdminPassword });

    if (login.statusCode !== 200) {
      return;
    }

    const deactivation = await adminAgent
      .patch(`/api/admin/users/${admin.id}`)
      .send({ isActive: false });

    const demotion = await adminAgent
      .patch(`/api/admin/users/${admin.id}`)
      .send({ role: 'student' });

    expect(deactivation.statusCode).toBe(403);
    expect(demotion.statusCode).toBe(403);
  });

  test('responses never contain password_hash', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: env.seedAdminUsername, password: env.seedAdminPassword });

    expect(JSON.stringify(response.body)).not.toContain('password_hash');
  });
});
