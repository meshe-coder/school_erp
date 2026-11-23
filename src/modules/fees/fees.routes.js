const express = require('express');
const feesController = require('./fees.controller');
const {
  bulkClassFeesSchema,
  overrideSchema,
  deleteOverrideQuerySchema,
  feeQuerySchema,
  studentFeesQuerySchema,
} = require('./fees.schemas');
const { validateBody, validateQuery } = require('../../middleware/validate');
const {
  ensureAuthenticated,
  requireRole,
  blockUntilPasswordChanged,
} = require('../../middleware/auth');

const router = express.Router();

router.use(ensureAuthenticated, blockUntilPasswordChanged);

router.get('/student/me/fee', requireRole('student'), feesController.getOwnFee);

router.get('/admin/terms/:termId/class-fees', requireRole('admin'), feesController.getClassFees);
router.put('/admin/terms/:termId/class-fees', requireRole('admin'), validateBody(bulkClassFeesSchema), feesController.putClassFees);
router.delete('/admin/terms/:termId/class-fees/:classId', requireRole('admin'), feesController.deleteClassFee);

router.get('/admin/students/:id/fee', requireRole('admin'), validateQuery(feeQuerySchema), feesController.getStudentFee);
router.put('/admin/students/:id/fee-override', requireRole('admin'), validateBody(overrideSchema), feesController.putStudentOverride);
router.delete('/admin/students/:id/fee-override', requireRole('admin'), validateQuery(deleteOverrideQuerySchema), feesController.deleteStudentOverride);

router.get('/admin/terms/:termId/student-fees', requireRole('admin'), validateQuery(studentFeesQuerySchema), feesController.getStudentFeesOverview);

module.exports = router;
