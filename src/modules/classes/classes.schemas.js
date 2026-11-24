const { z } = require('zod');

const gradeLevelCreateSchema = z.object({
  name: z.string().trim().min(1).max(40),
  sortOrder: z.coerce.number().int().optional().default(0),
});

const gradeLevelUpdateSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  sortOrder: z.coerce.number().int().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
});

const classCreateSchema = z.object({
  academicYearId: z.string().uuid(),
  gradeLevelId: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
});

const classUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
});

const classListSchema = z.object({
  academicYearId: z.string().uuid().optional(),
  gradeLevelId: z.string().uuid().optional(),
});

module.exports = {
  gradeLevelCreateSchema,
  gradeLevelUpdateSchema,
  classCreateSchema,
  classUpdateSchema,
  classListSchema,
};
