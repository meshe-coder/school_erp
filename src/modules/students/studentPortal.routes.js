const express = require('express');
const studentsController = require('./students.controller');
const {
  ensureAuthenticated,
  requireRole,
  blockUntilPasswordChanged,
} = require('../../middleware/auth');

const router = express.Router();

router.use(ensureAuthenticated, requireRole('student'), blockUntilPasswordChanged);
router.get('/student/me', studentsController.getOwnProfile);

module.exports = router;
