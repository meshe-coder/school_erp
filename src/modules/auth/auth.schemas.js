const { z } = require('zod');

const loginSchema = z.object({
  username: z.string().trim().min(1).max(60),
  password: z.string().min(1).max(72),
});

const passwordPolicy = z.string()
  .min(8)
  .max(72)
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordPolicy,
});

module.exports = { loginSchema, changePasswordSchema };
