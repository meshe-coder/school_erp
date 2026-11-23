const request = require('supertest');
const app = require('../src/app');

const stateHeader = { 'X-Requested-With': 'school-erp' };

describe('Static website and backend adjustments', () => {
  test('root and portal pages return HTML', async () => {
    const root = await request(app).get('/');
    const student = await request(app).get('/student/');
    const admin = await request(app).get('/admin/');

    expect(root.statusCode).toBe(200);
    expect(root.headers['content-type']).toContain('text/html');
    expect(student.statusCode).toBe(200);
    expect(admin.statusCode).toBe(200);
  });

  test('public config works without login', async () => {
    const response = await request(app).get('/api/config');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('schoolName');
    expect(response.body).toHaveProperty('paymentInstructions');
  });

  test('state-changing API requests require X-Requested-With', async () => {
    const missing = await request(app)
      .post('/api/auth/login')
      .set('X-Supertest-Skip-CSRF', '1')
      .send({ username: 'admin', password: 'wrong' });

    expect(missing.statusCode).toBe(403);
    expect(missing.body).toEqual({ error: 'Missing required header' });

    const present = await request(app)
      .post('/api/auth/login')
      .set(stateHeader)
      .send({ username: 'admin', password: 'wrong' });

    expect(present.statusCode).not.toBe(403);
  });

  test('unknown API paths remain JSON 404 and unknown pages are text 404', async () => {
    const api = await request(app).get('/api/not-a-real-route');
    const page = await request(app).get('/not-a-real-page');

    expect(api.statusCode).toBe(404);
    expect(api.headers['content-type']).toContain('application/json');
    expect(page.statusCode).toBe(404);
  });

  test('CSP keeps script-src self and disables upgrade-insecure-requests in development', async () => {
    const response = await request(app).get('/');
    const csp = response.headers['content-security-policy'] || '';

    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('upgrade-insecure-requests');
  });
});
