# School ERP Deployment Guide

This guide outlines how to deploy the School ERP backend and database to various production cloud platforms.

## Prerequisites

- Node.js LTS (v18+)
- PostgreSQL (v14+)
- Git repository connected to your hosting platform

---

## Environment Variables

Ensure the following environment variables are configured in your production environment:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Port number for Express server | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/dbname` |
| `SESSION_SECRET` | Secret key for express-session cookie signing | `random-secure-string` |
| `CORS_ORIGIN` | Allowed origin for frontend requests | `https://your-frontend.com` |
| `SEED_ADMIN_USERNAME` | Initial admin username | `admin` |
| `SEED_ADMIN_EMAIL` | Initial admin email | `admin@school.local` |
| `SEED_ADMIN_PASSWORD` | Initial admin password | `ChangeMe123!` |
| `MPESA_CONSUMER_KEY` | Safaricom Daraja Consumer Key | `your_consumer_key` |
| `MPESA_CONSUMER_SECRET` | Safaricom Daraja Consumer Secret | `your_consumer_secret` |
| `MPESA_SHORTCODE` | M-Pesa Paybill / Till / Shortcode | `174379` |
| `MPESA_PASSKEY` | M-Pesa Daraja Passkey | `your_passkey` |
| `MPESA_CALLBACK_URL` | Public callback URL for STK push / payments | `https://your-api.com/api/mpesa/callback` |

---

## Option 1: Deploying on Render (Recommended & Easiest)

Render supports automated deployments via Blueprints (`render.yaml`).

1. Push your repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New** -> **Blueprint**.
3. Connect your repository. Render will automatically detect `render.yaml`.
4. Configure your secret environment variables (`MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, etc.) in the Render dashboard during setup.
5. Render will automatically:
   - Provision a PostgreSQL database (`school-erp-db`).
   - Run `npm install`, database migrations (`npm run migrate`), and admin seeding (`npm run seed:admin`) on build.
   - Start your API server via `npm start`.

---

## Option 2: Deploying with Docker & Docker Compose (VPS / AWS / DigitalOcean)

You can containerize and run the app on any VPS (Ubuntu, Debian, etc.) using Docker Compose.

1. Clone your repository on your server:
   ```bash
   git clone https://github.com/meshe-coder/school_erp.git
   cd school_erp
   ```
2. Create a `.env` file or configure `docker-compose.yml` with your production environment variables and M-Pesa credentials.
3. Build and start containers in detached mode:
   ```bash
   docker compose up -d --build
   ```
4. Run database migrations inside the container:
   ```bash
   docker compose exec app npm run migrate
   docker compose exec app npm run seed:admin
   ```

---

## Option 3: Deploying on Railway / Fly.io / Heroku

1. **Railway**:
   - Create a new project and add a PostgreSQL plugin.
   - Connect your GitHub repository.
   - Add environment variables in the Railway dashboard.
   - Set Build Command: `npm install && npm run migrate && npm run seed:admin`
   - Set Start Command: `npm start`

2. **Fly.io**:
   - Run `fly launch` to initialize your Fly app configuration.
   - Attach a Postgres cluster using `fly postgres create`.
   - Set secrets using `fly secrets set DATABASE_URL=... SESSION_SECRET=...`.
   - Deploy using `fly deploy`.

---

## Post-Deployment Verification

1. Check server health/status logs:
   ```bash
   curl https://your-backend-url.com/api/health (or login endpoint)
   ```
2. Log in with your seed admin credentials (`admin@school.local` / `ChangeMe123!`) and change your password immediately.
3. Test M-Pesa STK push callback endpoints and ensure `MPESA_CALLBACK_URL` is publicly reachable.
