const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const env = require('../src/config/env');
const usersRepository = require('../src/modules/users/users.repository');

const prefix = 'test_academic_';

async function resetAcademicData() {
  await db.query("DELETE FROM terms WHERE name LIKE $1", [`${prefix}%`]);
  await db.query("DELETE FROM academic_years WHERE name LIKE $1", [`${prefix}%`]);
}

beforeAll(async () => {
  await resetAcademicData();
});

afterAll(async () => {
  await resetAcademicData();
  await db.pool.end();
});

describe('Academic years and terms', () => {
  test('only one academic year can be current', async () => {
    const admin = await usersRepository.findByUsername(env.seedAdminUsername);
    await db.query(
      `UPDATE users SET password_hash = password_hash,
       must_change_password = FALSE, is_active = TRUE, role = 'admin'
       WHERE id = $1`,
      [admin.id]
    );

    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({
      username: env.seedAdminUsername,
      password: env.seedAdminPassword,
    });

    const yearOne = await agent.post('/api/admin/academic-years').send({
      name: `${prefix}2026`,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    const yearTwo = await agent.post('/api/admin/academic-years').send({
      name: `${prefix}2027`,
      startDate: '2027-01-01',
      endDate: '2027-12-31',
    });

    expect(yearOne.statusCode).toBe(201);
    expect(yearTwo.statusCode).toBe(201);

    await agent.post(`/api/admin/academic-years/${yearOne.body.year.id}/set-current`);
    await agent.post(`/api/admin/academic-years/${yearTwo.body.year.id}/set-current`);

    const result = await db.query(
      'SELECT COUNT(*)::INTEGER AS count FROM academic_years WHERE is_current = TRUE'
    );
    expect(result.rows[0].count).toBe(1);

    const current = await agent.get('/api/academic/current');
    expect(current.statusCode).toBe(200);
    expect(current.body.academicYear.id).toBe(yearTwo.body.year.id);
  });

  test('rejects term outside academic year', async () => {
    const year = await db.query(
      `INSERT INTO academic_years (name, start_date, end_date)
       VALUES ($1, '2028-01-01', '2028-12-31')
       RETURNING id, name, start_date AS "startDate", end_date AS "endDate", is_current AS "isCurrent"`,
      [`${prefix}2028`]
    );

    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({
      username: env.seedAdminUsername,
      password: env.seedAdminPassword,
    });

    const outside = await agent
      .post(`/api/admin/academic-years/${year.rows[0].id}/terms`)
      .send({
        termNumber: 1,
        name: `${prefix}Term 1`,
        startDate: '2027-12-01',
        endDate: '2028-02-28',
      });

    expect(outside.statusCode).toBe(400);
  });

  test('rejects overlapping terms', async () => {
    const year = await db.query(
      `INSERT INTO academic_years (name, start_date, end_date)
       VALUES ($1, '2029-01-01', '2029-12-31')
       RETURNING id`,
      [`${prefix}2029`]
    );

    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({
      username: env.seedAdminUsername,
      password: env.seedAdminPassword,
    });

    const first = await agent
      .post(`/api/admin/academic-years/${year.rows[0].id}/terms`)
      .send({
        termNumber: 1,
        name: `${prefix}Term 1`,
        startDate: '2029-01-01',
        endDate: '2029-04-30',
      });

    const overlap = await agent
      .post(`/api/admin/academic-years/${year.rows[0].id}/terms`)
      .send({
        termNumber: 2,
        name: `${prefix}Term 2`,
        startDate: '2029-04-15',
        endDate: '2029-08-31',
      });

    expect(first.statusCode).toBe(201);
    expect(overlap.statusCode).toBe(400);
  });
});
