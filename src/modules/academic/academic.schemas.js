const { z } = require('zod');

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');

const academicYearCreateSchema = z.object({
  name: z.string().trim().min(1).max(20),
  startDate: dateString,
  endDate: dateString,
}).refine((value) => value.endDate > value.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

const academicYearUpdateSchema = z.object({
  name: z.string().trim().min(1).max(20).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
}).refine((value) => !value.startDate || !value.endDate || value.endDate > value.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

const termCreateSchema = z.object({
  termNumber: z.coerce.number().int().min(1).max(3),
  name: z.string().trim().min(1).max(30),
  startDate: dateString,
  endDate: dateString,
}).refine((value) => value.endDate > value.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

const termUpdateSchema = z.object({
  termNumber: z.coerce.number().int().min(1).max(3).optional(),
  name: z.string().trim().min(1).max(30).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
}).refine((value) => !value.startDate || !value.endDate || value.endDate > value.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

module.exports = {
  academicYearCreateSchema,
  academicYearUpdateSchema,
  termCreateSchema,
  termUpdateSchema,
};
