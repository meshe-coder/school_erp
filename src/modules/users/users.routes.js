const express = require('express');
const usersController = require('./users.controller');
const {
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
} = require('./users.schemas');
const { validateBody, validateQuery } = require('../../middleware/validate');
const {
  ensureAuthenticated,
  requireRole,
  blockUntilPasswordChanged,
} = require('../../middleware/auth');

const router = express.Router();

router.use(
  ensureAuthenticated,
  requireRole('admin'),
  blockUntilPasswordChanged
);

router.post('/', validateBody(createUserSchema), usersController.createUser);
router.get('/', validateQuery(listUsersSchema), usersController.listUsers);
router.get('/:id', usersController.getUser);
router.patch('/:id', validateBody(updateUserSchema), usersController.updateUser);
router.post('/:id/reset-password', usersController.resetPassword);

module.exports = router;
