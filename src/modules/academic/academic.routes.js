const express = require('express');
const academicController = require('./academic.controller');
const {
  academicYearCreateSchema,
  academicYearUpdateSchema,
  termCreateSchema,
  termUpdateSchema,
} = require('./academic.schemas');
const { validateBody } = require('../../middleware/validate');
const {
  ensureAuthenticated,
  requireRole,
  blockUntilPasswordChanged,
} = require('../../middleware/auth');

const router = express.Router();

router.get('/academic/current', ensureAuthenticated, blockUntilPasswordChanged, academicController.getCurrentAcademic);

router.use('/admin/academic-years', ensureAuthenticated, requireRole('admin'), blockUntilPasswordChanged);
router.post('/admin/academic-years', validateBody(academicYearCreateSchema), academicController.createYear);
router.get('/admin/academic-years', academicController.listYears);
router.patch('/admin/academic-years/:id', validateBody(academicYearUpdateSchema), academicController.updateYear);
router.post('/admin/academic-years/:id/set-current', academicController.setCurrentYear);
router.post('/admin/academic-years/:id/terms', validateBody(termCreateSchema), academicController.createTerm);

router.use('/admin/terms', ensureAuthenticated, requireRole('admin'), blockUntilPasswordChanged);
router.patch('/admin/terms/:id', validateBody(termUpdateSchema), academicController.updateTerm);
router.post('/admin/terms/:id/set-current', academicController.setCurrentTerm);

module.exports = router;
