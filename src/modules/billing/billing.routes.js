const express = require('express');
const billingController = require('./billing.controller');
const {
  generateBillsSchema,
  billListSchema,
  paymentCreateSchema,
  paymentListSchema,
  reversePaymentSchema,
  balanceListSchema,
} = require('./billing.schemas');
const { validateBody, validateQuery } = require('../../middleware/validate');
const {
  ensureAuthenticated,
  requireRole,
  blockUntilPasswordChanged,
} = require('../../middleware/auth');

const router = express.Router();

router.use('/admin', ensureAuthenticated, requireRole('admin'), blockUntilPasswordChanged);

router.post('/admin/terms/:termId/generate-bills', validateBody(generateBillsSchema), billingController.generateBills);
router.get('/admin/terms/:termId/bills', validateQuery(billListSchema), billingController.listBills);
router.post('/admin/payments', validateBody(paymentCreateSchema), billingController.createPayment);
router.get('/admin/payments', validateQuery(paymentListSchema), billingController.listPayments);
router.post('/admin/payments/:id/reverse', validateBody(reversePaymentSchema), billingController.reversePayment);
router.get('/admin/students/:id/statement', billingController.getAdminStudentStatement);
router.get('/admin/balances', validateQuery(balanceListSchema), billingController.getBalances);
router.get('/admin/dashboard', billingController.getDashboard);

module.exports = router;
