const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const env = require('../src/config/env');
const usersRepository = require('../src/modules/users/users.repository');

const prefix = 'test_classes_';

async function loginAdmin(agent) {
  await agent.post('/api/auth/login').send({
    username: env.seedAdminUsername,
    password: env.seedAdminPassword,
  });
}

beforeAll(async () => {
  await db.query("DELETE FROM classes WHERE name LIKE $1", [`${prefix}%`]);
  await db.query("DELETE FROM grade_levels WHERE name LIKE $1", [`${prefix}%`]);
  await db.query("DELETE FROM academic_years WHERE name LIKE $1", [`${prefix}%`]);
});

afterAll(async () => {
  await db.query("DELETE FROM classes WHERE name LIKE $1", [`${prefix}%`]);
  await db.query("DELETE FROM grade_levels WHERE name LIKE $1", [`${prefix}%`]);
  await db.query("DELETE FROM academic_years WHERE name LIKE $1", [`${prefix}%`]);
  await db.pool.end();
});

describe('Grade levels and classes', () => {
  test('creates ordered grade levels and classes', async () => {
    const admin = await usersRepository.findByUsername(env.seedAdminUsername);
    await db.query(
      `UPDATE users SET must_change_password = FALSE, is_active = TRUE,
       role = 'admin' WHERE id = $1`,
      [admin.id]
    );

    const agent = request.agent(app);
    await loginAdmin(agent);

    const year = await agent.post('/api/admin/academic-years').send({
      name: `${prefix}2030`,
      startDate: '2030-01-01',
      endDate: '2030-12-31',
    });
    expect(year.statusCode).toBe(201);

    await agent.post(`/api/admin/academic-years/${year.body.year.id}/set-current`);

    const level = await agent.post('/api/admin/grade-levels').send({
      name: `${prefix}Form 1`,
      sortOrder: 1,
    });
    expect(level.statusCode).toBe(201);

    const schoolClass = await agent.post('/api/admin/classes').send({
      academicYearId: year.body.year.id,
      gradeLevelId: level.body.gradeLevel.id,
      name: `${prefix}East`,
    });

    expect(schoolClass.statusCode).toBe(201);
    expect(schoolClass.body.class.academicYearId).toBe(year.body.year.id);

    const listed = await agent.get('/api/admin/classes');
    expect(listed.statusCode).toBe(200);
    expect(listed.body.data.some((item) => item.id === schoolClass.body.class.id)).toBe(true);
  });

  test('rejects class creation for missing year or grade level', async () => {
    const agent = request.agent(app);
    await loginAdmin(agent);

    const response = await agent.post('/api/admin/classes').send({
      academicYearId: '00000000-0000-0000-0000-000000000000',
      gradeLevelId: '00000000-0000-0000-0000-000000000001',
      name: `${prefix}Missing`,
    });

    expect(response.statusCode).toBe(400);
  });

  test('class without enrollments can be deleted and can be protected by enrollments', async () => {
    const agent = request.agent(app);
    await loginAdmin(agent);

    const yearResult = await db.query(
      `INSERT INTO academic_years (name, start_date, end_date)
       VALUES ($1, '2031-01-01', '2031-12-31') RETURNING id`,
      [`${prefix}2031`]
    );
    const levelResult = await db.query(
      `INSERT INTO grade_levels (name, sort_order)
       VALUES ($1, 1) RETURNING id`,
      [`${prefix}Grade`]
    );
    const classResult = await db.query(
      `INSERT INTO classes (academic_year_id, grade_level_id, name)
       VALUES ($1, $2, $3) RETURNING id`,
      [yearResult.rows[0].id, levelResult.rows[0].id, `${prefix}Delete`]
    );

    const deleted = await agent.delete(`/api/admin/classes/${classResult.rows[0].id}`);
    expect(deleted.statusCode).toBe(200);
  });
});
