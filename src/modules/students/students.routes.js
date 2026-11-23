const express = require('express');
const studentsController = require('./students.controller');
const {
  createStudentSchema,
  updateStudentSchema,
  listStudentsSchema,
  guardianSchema,
  guardianUpdateSchema,
  enrollStudentSchema,
  promoteStudentsSchema,
} = require('./students.schemas');
const { validateBody, validateQuery } = require('../../middleware/validate');
const {
  ensureAuthenticated,
  requireRole,
  blockUntilPasswordChanged,
} = require('../../middleware/auth');

const router = express.Router();

router.use('/admin', ensureAuthenticated, requireRole('admin'), blockUntilPasswordChanged);

router.post('/admin/students', validateBody(createStudentSchema), studentsController.createStudent);
router.get('/admin/students', validateQuery(listStudentsSchema), studentsController.listStudents);
router.post('/admin/students/promote', validateBody(promoteStudentsSchema), studentsController.promoteStudents);
router.get('/admin/students/:id', studentsController.getStudent);
router.patch('/admin/students/:id', validateBody(updateStudentSchema), studentsController.updateStudent);
router.post('/admin/students/:id/guardians', validateBody(guardianSchema), studentsController.addGuardian);
router.patch('/admin/students/:id/guardians/:guardianId', validateBody(guardianUpdateSchema), studentsController.updateGuardian);
router.delete('/admin/students/:id/guardians/:guardianId', studentsController.deleteGuardian);
router.post('/admin/students/:id/enroll', validateBody(enrollStudentSchema), studentsController.enrollStudent);

module.exports = router;
