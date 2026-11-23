const express = require('express');
const authController = require('./auth.controller');
const { loginSchema, changePasswordSchema } = require('./auth.schemas');
const { validateBody } = require('../../middleware/validate');
const { loginLimiter } = require('../../middleware/rateLimit');
const {
  ensureAuthenticated,
  blockUntilPasswordChanged,
} = require('../../middleware/auth');

const router = express.Router();

router.post(
  '/login',
  loginLimiter,
  validateBody(loginSchema),
  authController.login
);
router.post('/logout', ensureAuthenticated, authController.logout);
router.get(
  '/me',
  ensureAuthenticated,
  blockUntilPasswordChanged,
  authController.me
);
router.post(
  '/change-password',
  ensureAuthenticated,
  validateBody(changePasswordSchema),
  authController.changePassword
);

module.exports = router;
