const express = require('express');
const mpesaController = require('./mpesa.controller');
const { stkPushSchema, stkQuerySchema, stkListSchema } = require('./mpesa.schemas');
const { validateBody, validateQuery } = require('../../middleware/validate');
const { ensureAuthenticated, requireRole, blockUntilPasswordChanged } = require('../../middleware/auth');

const router = express.Router();

/**
 * Admin: Initiate STK Push to a student's phone
 * POST /api/admin/mpesa/stk-push
 */
router.post(
  '/admin/mpesa/stk-push',
  ensureAuthenticated,
  requireRole('admin'),
  blockUntilPasswordChanged,
  validateBody(stkPushSchema),
  mpesaController.initiateSTKPush
);

/*** Admin: Query STK Push status** GET /api/admin/mpesa/stk-status/:checkoutRequestId*/
router.get(
  '/admin/mpesa/stk-status/:checkoutRequestId',
  ensureAuthenticated,
  requireRole('admin'),
  blockUntilPasswordChanged,
  validateQuery(stkQuerySchema),
  mpesaController.querySTKStatus
);

/*** Admin: List STK Push requests*** GET /api/admin/mpesa/requests*/
router.get(
  '/admin/mpesa/requests',
  ensureAuthenticated,
  requireRole('admin'),
  blockUntilPasswordChanged,
  validateQuery(stkListSchema),
  mpesaController.listRequests
);

/*** PUBLIC: Safaricom Daraja Callback** POST /api/mpesa/callback** This endpoint MUST be public (no auth) because Safaricom calls it directly.*/router.post('/mpesa/callback', mpesaController.handleCallback);

module.exports = router;
