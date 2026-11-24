const env = require('../../config/env');

/**
 * M-Pesa Daraja API Configuration
 */
module.exports = {
  consumerKey: env.mpesa.consumerKey,
  consumerSecret: env.mpesa.consumerSecret,
  shortcode: env.mpesa.shortcode,
  passkey: env.mpesa.passkey,
  callbackUrl: env.mpesa.callbackUrl,
  environment: env.mpesa.environment,
  baseUrl: env.mpesa.baseUrl,
  transType: env.mpesa.transType,
  accountReference: env.mpesa.accountReference,
  transactionDescription: env.mpesa.transactionDescription,

  endpoints: {
    token: '/oauth/v1/generate?grant_type=client_credentials',
    stkPush: '/mpesa/stkpush/v1/processrequest',
    query: '/mpesa/stkpushquery/v1/query',
  },

  timeouts: {
    token: 10000,
    stkPush: 15000,
  },

  amounts: {
    min: 1,
    max: 250000,
  },
};

