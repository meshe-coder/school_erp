const { z } = require('zod');

const passwordPolicy = z.string()
  .min(8)
  .max(72)
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const createUserSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(255).optional(),
  role: z.enum(['admin', 'teacher', 'student']),
  password: passwordPolicy.optional(),
});

const listUsersSchema = z.object({
  role: z.enum(['admin', 'teacher', 'student']).optional(),
  isActive: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  search: z.string().trim().max(255).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const updateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255).optional(),
  role: z.enum(['admin', 'teacher', 'student']).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
});

module.exports = {
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
};
