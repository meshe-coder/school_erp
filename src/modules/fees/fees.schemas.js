const { z } = require('zod');
const { moneySchema, moneyOrZeroSchema } = require('../../utils/money');

const bulkClassFeesSchema = z.object({
  fees: z.array(z.object({
    classId: z.string().uuid(),
    amount: moneySchema,
  })).min(1),
});

const overrideSchema = z.object({
  termId: z.string().uuid(),
  amount: moneyOrZeroSchema,
  reason: z.string().trim().min(3).max(255),
});

const feeQuerySchema = z.object({
  termId: z.string().uuid(),
});

const deleteOverrideQuerySchema = z.object({
  termId: z.string().uuid(),
});

const studentFeesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  classId: z.string().uuid().optional(),
  search: z.string().trim().max(255).optional(),
  missingFee: z.enum(['true', 'false']).optional(),
});

module.exports = {
  bulkClassFeesSchema,
  overrideSchema,
  feeQuerySchema,
  deleteOverrideQuerySchema,
  studentFeesQuerySchema,
};
