const express = require('express');
const classesController = require('./classes.controller');
const {
  gradeLevelCreateSchema,
  gradeLevelUpdateSchema,
  classCreateSchema,
  classUpdateSchema,
  classListSchema,
} = require('./classes.schemas');
const { validateBody, validateQuery } = require('../../middleware/validate');
const {
  ensureAuthenticated,
  requireRole,
  blockUntilPasswordChanged,
} = require('../../middleware/auth');

const router = express.Router();

router.use('/admin', ensureAuthenticated, requireRole('admin'), blockUntilPasswordChanged);

router.post('/admin/grade-levels', validateBody(gradeLevelCreateSchema), classesController.createGradeLevel);
router.get('/admin/grade-levels', classesController.listGradeLevels);
router.patch('/admin/grade-levels/:id', validateBody(gradeLevelUpdateSchema), classesController.updateGradeLevel);

router.post('/admin/classes', validateBody(classCreateSchema), classesController.createClass);
router.get('/admin/classes', validateQuery(classListSchema), classesController.listClasses);
router.patch('/admin/classes/:id', validateBody(classUpdateSchema), classesController.updateClass);
router.delete('/admin/classes/:id', classesController.deleteClass);

module.exports = router;
