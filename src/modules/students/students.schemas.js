const { z } = require('zod');

const passwordPolicy = z.string().min(8).max(72).regex(/[A-Za-z]/).regex(/[0-9]/);

const guardianSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  relationship: z.string().trim().min(1).max(30),
  phone: z.string().trim().min(1).max(30),
  email: z.string().trim().email().max(255).optional(),
  isPrimary: z.boolean().optional().default(false),
});

const guardianUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  relationship: z.string().trim().min(1).max(30).optional(),
  phone: z.string().trim().min(1).max(30).optional(),
  email: z.string().trim().email().max(255).nullable().optional(),
  isPrimary: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
});

const createStudentSchema = z.object({
  admissionNumber: z.string().trim().min(1).max(30),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  otherNames: z.string().trim().max(100).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(['male', 'female']).optional(),
  admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  email: z.string().trim().toLowerCase().email().max(255).optional(),
  guardians: z.array(guardianSchema).optional().default([]),
  classId: z.string().uuid().nullable().optional(),
  password: passwordPolicy.optional(),
});

const updateStudentSchema = z.object({
  admissionNumber: z.string().trim().min(1).max(30).optional(),
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  otherNames: z.string().trim().max(100).nullable().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  gender: z.enum(['male', 'female']).nullable().optional(),
  admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['active', 'graduated', 'transferred', 'suspended']).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
});

const listStudentsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  classId: z.string().uuid().optional(),
  gradeLevelId: z.string().uuid().optional(),
  status: z.enum(['active', 'graduated', 'transferred', 'suspended']).optional(),
  search: z.string().trim().max(255).optional(),
});

const enrollStudentSchema = z.object({
  classId: z.string().uuid(),
});

const promoteStudentsSchema = z.object({
  fromAcademicYearId: z.string().uuid(),
  toAcademicYearId: z.string().uuid(),
  mappings: z.array(z.object({
    fromClassId: z.string().uuid(),
    toClassId: z.string().uuid(),
  })).min(1),
  excludeStudentIds: z.array(z.string().uuid()).optional().default([]),
});

module.exports = {
  guardianSchema,
  guardianUpdateSchema,
  createStudentSchema,
  updateStudentSchema,
  listStudentsSchema,
  enrollStudentSchema,
  promoteStudentsSchema,
};
