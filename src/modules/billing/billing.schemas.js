const { z } = require('zod');
const { moneySchema } = require('../../utils/money');

const generateBillsSchema = z.object({
  refresh: z.boolean().optional().default(false),
});

const billListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  classId: z.string().uuid().optional(),
  search: z.string().trim().max(255).optional(),
});

const paymentCreateSchema = z.object({
  studentId: z.string().uuid().optional(),
  admissionNumber: z.string().trim().toUpperCase().min(1).max(30).optional(),
  amount: moneySchema,
  method: z.enum(['cash', 'mpesa', 'bank', 'other']),
  reference: z.string().trim().toUpperCase().max(60).optional(),
  paidAt: z.string().datetime({ offset: true }).optional(),
  note: z.string().trim().max(255).optional(),
}).refine(
  (value) => Boolean(value.studentId) !== Boolean(value.admissionNumber),
  { message: 'Exactly one of studentId or admissionNumber is required' }
).refine(
  (value) => value.method !== 'mpesa' || /^[A-Z0-9]{10}$/.test(value.reference || ''),
  { message: 'M-Pesa reference must contain exactly 10 letters or digits' }
).refine(
  (value) => value.method !== 'bank' || Boolean(value.reference),
  { message: 'Bank payments require a reference' }
);

const paymentListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  studentId: z.string().uuid().optional(),
  method: z.enum(['cash', 'mpesa', 'bank', 'other']).optional(),
  status: z.enum(['valid', 'reversed']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().trim().max(255).optional(),
});

const reversePaymentSchema = z.object({
  reason: z.string().trim().min(3).max(255),
});

const balanceListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  classId: z.string().uuid().optional(),
  owing: z.enum(['true', 'false']).optional(),
  search: z.string().trim().max(255).optional(),
});

module.exports = {
  generateBillsSchema,
  billListSchema,
  paymentCreateSchema,
  paymentListSchema,
  reversePaymentSchema,
  balanceListSchema,
};
