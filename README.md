# School ERP

School ERP authentication module built with Node.js, Express, PostgreSQL, Passport sessions, bcrypt, Zod, and plain `pg`.

## Requirements

- Node.js LTS
- PostgreSQL
- npm

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

3. Set a real PostgreSQL URL and session secret in `.env`:

   ```env
   NODE_ENV=development
   PORT=4000
   DATABASE_URL=postgres://erp_user:your_password@localhost:5432/school_erp
   SESSION_SECRET=replace-with-a-long-random-string
   CORS_ORIGIN=http://localhost:3000
   SEED_ADMIN_USERNAME=admin
   SEED_ADMIN_EMAIL=admin@example.com
   SEED_ADMIN_PASSWORD=ChangeMe123!
   ```

4. Apply the authentication migration:

   ```bash
   npm run migrate
   ```

5. Create the initial administrator:

   ```bash
   npm run seed:admin
   ```

6. Start the API:

   ```bash
   npm run dev
   ```

   The API is available at `http://localhost:4000/api`.

## Tests

```bash
npm test
```

Tests use Supertest, PostgreSQL, and cookie agents. Test users are cleaned up after the suite finishes.

## Authentication API

### Login

```bash
curl -i -c cookies.txt -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}' \
  http://localhost:4000/api/auth/login
```

### Current user

```bash
curl -i -b cookies.txt http://localhost:4000/api/auth/me
```

### Change password

```bash
curl -i -b cookies.txt -H "Content-Type: application/json" \
  -d '{"currentPassword":"ChangeMe123!","newPassword":"NewPassword123!"}' \
  http://localhost:4000/api/auth/change-password
```

### Logout

```bash
curl -i -b cookies.txt -X POST http://localhost:4000/api/auth/logout
```

## Admin user management

Requires an authenticated admin session.

```bash
# Create a user
curl -i -b cookies.txt -H "Content-Type: application/json" \
  -d '{"username":"teacher1","email":"teacher1@example.com","role":"teacher"}' \
  http://localhost:4000/api/admin/users

# List users
curl -i -b cookies.txt 'http://localhost:4000/api/admin/users?role=teacher&page=1&limit=20'

# Get a user
curl -i -b cookies.txt http://localhost:4000/api/admin/users/USER_ID

# Update a user
curl -i -b cookies.txt -X PATCH -H "Content-Type: application/json" \
  -d '{"isActive":false}' \
  http://localhost:4000/api/admin/users/USER_ID

# Reset a password
curl -i -b cookies.txt -X POST \
  http://localhost:4000/api/admin/users/USER_ID/reset-password
```

## Step 2 endpoints

### Academic structure

- `POST /api/admin/academic-years`
- `GET /api/admin/academic-years`
- `PATCH /api/admin/academic-years/:id`
- `POST /api/admin/academic-years/:id/set-current`
- `POST /api/admin/academic-years/:id/terms`
- `PATCH /api/admin/terms/:id`
- `POST /api/admin/terms/:id/set-current`
- `GET /api/academic/current`

### Grade levels and classes

- `POST /api/admin/grade-levels`
- `GET /api/admin/grade-levels`
- `PATCH /api/admin/grade-levels/:id`
- `POST /api/admin/classes`
- `GET /api/admin/classes`
- `PATCH /api/admin/classes/:id`
- `DELETE /api/admin/classes/:id`

### Students and teachers

- `POST /api/admin/students`
- `GET /api/admin/students`
- `GET /api/admin/students/:id`
- `PATCH /api/admin/students/:id`
- `POST /api/admin/students/:id/guardians`
- `PATCH /api/admin/students/:id/guardians/:guardianId`
- `DELETE /api/admin/students/:id/guardians/:guardianId`
- `POST /api/admin/students/:id/enroll`
- `POST /api/admin/students/promote`
- `GET /api/student/me`
- `POST /api/admin/teachers`
- `GET /api/admin/teachers`
- `GET /api/admin/teachers/:id`
- `PATCH /api/admin/teachers/:id`
- `GET /api/teacher/me`
- `GET /api/teacher/classes/:classId/students`

Profile and guardian phone values are normalized to `254XXXXXXXXX` before storage.

## Step 3 fees

### Admin class fees

- `GET /api/admin/terms/:termId/class-fees`
- `PUT /api/admin/terms/:termId/class-fees`
- `DELETE /api/admin/terms/:termId/class-fees/:classId`

Bulk fee example:

```bash
curl -i -b cookies.txt -X PUT -H "Content-Type: application/json" \
  -d '{"fees":[{"classId":"CLASS_ID","amount":"12000.50"}]}' \
  http://localhost:4000/api/admin/terms/TERM_ID/class-fees
```

### Student fee overrides

- `PUT /api/admin/students/:id/fee-override`
- `DELETE /api/admin/students/:id/fee-override?termId=TERM_ID`
- `GET /api/admin/students/:id/fee?termId=TERM_ID`
- `GET /api/admin/terms/:termId/student-fees`

Override example:

```bash
curl -i -b cookies.txt -X PUT -H "Content-Type: application/json" \
  -d '{"termId":"TERM_ID","amount":"0.00","reason":"Sibling discount"}' \
  http://localhost:4000/api/admin/students/STUDENT_ID/fee-override
```

### Student self-service

```bash
curl -i -b cookies.txt http://localhost:4000/api/student/me/fee
```

Fee amounts are returned as strings with exactly two decimal places. Totals are calculated in PostgreSQL using `NUMERIC(12,2)` values.

## Step 4 billing and balances

### Bills

- `POST /api/admin/terms/:termId/generate-bills`
- `GET /api/admin/terms/:termId/bills`

Generate bills example:

```bash
curl -i -b cookies.txt -X POST -H "Content-Type: application/json" \
  -d '{"refresh":false}' \
  http://localhost:4000/api/admin/terms/TERM_ID/generate-bills
```

### Payments

- `POST /api/admin/payments`
- `GET /api/admin/payments`
- `POST /api/admin/payments/:id/reverse`

Cash payment example:

```bash
curl -i -b cookies.txt -X POST -H "Content-Type: application/json" \
  -d '{"admissionNumber":"ADM001","amount":"5000.00","method":"cash"}' \
  http://localhost:4000/api/admin/payments
```

M-Pesa reference example:

```bash
curl -i -b cookies.txt -X POST -H "Content-Type: application/json" \
  -d '{"studentId":"STUDENT_ID","amount":"5000.00","method":"mpesa","reference":"ABC1234567"}' \
  http://localhost:4000/api/admin/payments
```

### Statements and balances

- `GET /api/admin/students/:id/statement`
- `GET /api/admin/balances`
- `GET /api/admin/dashboard`
- `GET /api/student/me/statement`

Balances are calculated live from bills and valid payments. Reversed payments do not contribute to totals.

## Security notes

- Authentication uses HTTP-only, session cookies; no JWT is used.
- Sessions are stored in PostgreSQL.
- Passwords use bcrypt cost 12.
- Login attempts are limited by IP and username.
- CORS allows only `CORS_ORIGIN` and credentials.
- CSRF protection remains required before payment endpoints go live.
