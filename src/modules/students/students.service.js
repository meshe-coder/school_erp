const crypto = require('crypto');
const db = require('../../config/db');
const usersRepository = require('../users/users.repository');
const studentsRepository = require('./students.repository');
const { hashPassword } = require('../../utils/password');
const { normalizePhone } = require('../../utils/phone');

function generateTemporaryPassword() {
  return `${crypto.randomBytes(6).toString('base64url')}A1`;
}

async function createStudent(fields, createdBy) {
  return db.withTransaction(async (client) => {
    const admissionNumber = fields.admissionNumber.trim().toUpperCase();

    const duplicateProfile = await studentsRepository.findByAdmissionNumber(admissionNumber, client);
    if (duplicateProfile) {
      const error = new Error('Admission number already exists');
      error.statusCode = 409;
      throw error;
    }

    const duplicateUser = await usersRepository.findByUsername(admissionNumber.toLowerCase(), client);
    if (duplicateUser) {
      const error = new Error('Login username already exists');
      error.statusCode = 409;
      throw error;
    }

    let selectedClass = null;
    if (fields.classId) {
      selectedClass = await studentsRepository.findClassById(fields.classId, client);
      if (!selectedClass) {
        const error = new Error('Class does not exist');
        error.statusCode = 400;
        throw error;
      }
    }

    const temporaryPassword = fields.password || generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const user = await usersRepository.createUser({
      username: admissionNumber.toLowerCase(),
      email: fields.email,
      passwordHash,
      role: 'student',
      createdBy,
    }, client);

    const student = await studentsRepository.createStudent({
      userId: user.id,
      admissionNumber,
      firstName: fields.firstName,
      lastName: fields.lastName,
      otherNames: fields.otherNames,
      dateOfBirth: fields.dateOfBirth,
      gender: fields.gender,
      admissionDate: fields.admissionDate,
    }, client);

    const guardians = [];
    let primaryAdded = false;

    for (const guardian of fields.guardians || []) {
      const phone = normalizePhone(guardian.phone);
      if (guardian.isPrimary && primaryAdded) {
        await studentsRepository.demotePrimaryGuardian(student.id, client);
      }

      const createdGuardian = await studentsRepository.addGuardian(student.id, {
        fullName: guardian.fullName,
        relationship: guardian.relationship,
        phone,
        email: guardian.email,
        isPrimary: guardian.isPrimary,
      }, client);
      guardians.push(createdGuardian);

      if (guardian.isPrimary) primaryAdded = true;
    }

    let enrollment = null;
    if (selectedClass) {
      enrollment = await studentsRepository.moveEnrollment(
        student.id,
        selectedClass.academicYearId,
        selectedClass.id,
        client
      );
    }

    return {
      student,
      guardians,
      enrollment,
      temporaryPassword: fields.password ? undefined : temporaryPassword,
    };
  });
}

module.exports = { createStudent };
