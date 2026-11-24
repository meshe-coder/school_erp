const { z } = require('zod');
const { moneySchema } = require('../../utils/money');

/**
 * Schema for initiating an STK Push request.
 */
const stkPushSchema = z.object({
  studentId: z.string().uuid('Student ID must be a valid UUID'),
  amount: moneySchema,
  phone: z.string().trim().min(1).max(30),
});

/**
 * Schema for querying STK Push status.
 */
const stkQuerySchema = z.object({
  checkoutRequestId: z.string().trim().min(1).max(100),
});

/**
 * Schema for listing STK Push requests.
 */
const stkListSchema = z.object({
  studentId: z.string().uuid().optional(),
  status: z.enum(['pending', 'sent', 'completed', 'failed', 'cancelled']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

module.exports = {
  stkPushSchema,
  stkQuerySchema,
  stkListSchema,
};
