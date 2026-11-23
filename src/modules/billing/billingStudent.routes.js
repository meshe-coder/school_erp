const express = require('express');
const billingController = require('./billing.controller');
const {
  ensureAuthenticated,
  requireRole,
  blockUntilPasswordChanged,
} = require('../../middleware/auth');

const router = express.Router();

router.use(ensureAuthenticated, requireRole('student'), blockUntilPasswordChanged);
router.get('/student/me/statement', billingController.getOwnStudentStatement);

module.exports = router;
