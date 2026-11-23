const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const requiredVariables = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'SESSION_SECRET',
  'CORS_ORIGIN',
  'SEED_ADMIN_USERNAME',
  'SEED_ADMIN_EMAIL',
  'SEED_ADMIN_PASSWORD',
];

const missing = requiredVariables.filter((name) => !process.env[name]);

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const port = Number(process.env.PORT);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid port number');
}

module.exports = {
  nodeEnv: process.env.NODE_ENV,
  port,
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET,
  corsOrigin: process.env.CORS_ORIGIN,
  seedAdminUsername: process.env.SEED_ADMIN_USERNAME,
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL,
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD,
  schoolName: process.env.SCHOOL_NAME || 'My School',
  paymentInstructions: process.env.PAYMENT_INSTRUCTIONS || '',
};
