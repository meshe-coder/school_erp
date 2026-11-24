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
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_SHORTCODE',
  'MPESA_PASSKEY',
  'MPESA_CALLBACK_URL',
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
  mpesa: {
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    shortcode: process.env.MPESA_SHORTCODE,
    passkey: process.env.MPESA_PASSKEY,
    callbackUrl: process.env.MPESA_CALLBACK_URL,
    environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
    baseUrl: process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke',
    transType: process.env.MPESA_TRANS_TYPE || 'PayBill',
    accountReference: process.env.MPESA_ACCOUNT_REFERENCE || 'School Fees',
    transactionDescription: process.env.MPESA_TRANSACTION_DESCRIPTION || 'School fee payment',
  },
};
