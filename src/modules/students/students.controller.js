const db = require('../../config/db');
const studentsRepository = require('./students.repository');
const studentsService = require('./students.service');
const usersRepository = require('../users/users.repository');
const { normalizePhone } = require('../../utils/phone');

async function createStudent(req, res, next) {
  try {
    const result = await studentsService.createStudent(req.body, req.user.id);
    const response = {
      student: result.student,
      guardians: result.guardians,
      enrollment: result.enrollment,
    };
    if (result.temporaryPassword) response.temporaryPassword = result.temporaryPassword;
    return res.status(201).json(response);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === '23505') return res.status(409).json({ error: 'Admission number already exists' });
    return next(error);
  }
}

async function listStudents(req, res, next) {
  try {
    const result = await studentsRepository.listStudents(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

async function getStudent(req, res, next) {
  try {
    const student = await studentsRepository.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const guardians = await studentsRepository.listGuardians(req.params.id);
    const enrollmentHistory = await studentsRepository.listEnrollmentHistory(req.params.id);
    return res.status(200).json({ student, guardians, enrollmentHistory });
  } catch (error) {
    return next(error);
  }
}

async function updateStudent(req, res, next) {
  try {
    const existing = await studentsRepository.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Student not found' });

    const fields = { ...req.body };
    if (fields.admissionNumber !== undefined) {
      fields.admissionNumber = fields.admissionNumber.trim().toUpperCase();
    }

    await db.withTransaction(async (client) => {
      if (fields.admissionNumber) {
        const duplicate = await studentsRepository.findByAdmissionNumber(fields.admissionNumber, client);
        if (duplicate && duplicate.id !== req.params.id) {
          const error = new Error('Admission number already exists');
          error.statusCode = 409;
          throw error;
        }
        if (fields.admissionNumber !== existing.admissionNumber) {
          await client.query(
            'UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2',
            [fields.admissionNumber.toLowerCase(), existing.userId]
          );
        }
      }

      existing.updated = await studentsRepository.updateStudent(req.params.id, fields, client);
    });

    return res.status(200).json({ student: existing.updated });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === '23505') return res.status(409).json({ error: 'Admission number already exists' });
    return next(error);
  }
}

async function addGuardian(req, res, next) {
  try {
    const student = await studentsRepository.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const fields = {
      ...req.body,
      phone: normalizePhone(req.body.phone),
    };

    let guardian;
    await db.withTransaction(async (client) => {
      if (fields.isPrimary) {
        await studentsRepository.demotePrimaryGuardian(req.params.id, client);
      }
      guardian = await studentsRepository.addGuardian(req.params.id, fields, client);
    });

    return res.status(201).json({ guardian });
  } catch (error) {
    if (error.message && error.message.includes('mobile phone')) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
}

async function updateGuardian(req, res, next) {
  try {
    const student = await studentsRepository.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const guardian = await studentsRepository.findGuardianById(req.params.guardianId);
    if (!guardian || guardian.studentId !== req.params.id) {
      return res.status(404).json({ error: 'Guardian not found' });
    }

    const fields = { ...req.body };
    if (fields.phone !== undefined) fields.phone = normalizePhone(fields.phone);

    await db.withTransaction(async (client) => {
      if (fields.isPrimary === true) {
        await studentsRepository.demotePrimaryGuardian(req.params.id, client);
      }
      resultGuardian = await studentsRepository.updateGuardian(req.params.guardianId, fields, client);
    });

    return res.status(200).json({ guardian: resultGuardian });
  } catch (error) {
    if (error.message && error.message.includes('mobile phone')) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
}

async function deleteGuardian(req, res, next) {
  try {
    const guardian = await studentsRepository.findGuardianById(req.params.guardianId);
    if (!guardian || guardian.studentId !== req.params.id) {
      return res.status(404).json({ error: 'Guardian not found' });
    }

    await studentsRepository.deleteGuardian(req.params.guardianId);
    return res.status(200).json({ message: 'Guardian deleted' });
  } catch (error) {
    return next(error);
  }
}

async function enrollStudent(req, res, next) {
  try {
    const student = await studentsRepository.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const schoolClass = await studentsRepository.findClassById(req.body.classId);
    if (!schoolClass) return res.status(400).json({ error: 'Class does not exist' });

    const enrollment = await studentsRepository.moveEnrollment(
      req.params.id,
      schoolClass.academicYearId,
      schoolClass.id
    );
    return res.status(200).json({ enrollment });
  } catch (error) {
    return next(error);
  }
}

async function promoteStudents(req, res, next) {
  try {
    const counts = await db.withTransaction(async (client) => {
      const fromYear = await client.query('SELECT id FROM academic_years WHERE id = $1', [req.body.fromAcademicYearId]);
      const toYear = await client.query('SELECT id FROM academic_years WHERE id = $1', [req.body.toAcademicYearId]);
      if (!fromYear.rows.length || !toYear.rows.length) {
        const error = new Error('Academic year does not exist');
        error.statusCode = 400;
        throw error;
      }

      const countByClass = {};

      for (const mapping of req.body.mappings) {
        const fromClass = await client.query(
          'SELECT id FROM classes WHERE id = $1 AND academic_year_id = $2',
          [mapping.fromClassId, req.body.fromAcademicYearId]
        );
        const toClass = await client.query(
          'SELECT id FROM classes WHERE id = $1 AND academic_year_id = $2',
          [mapping.toClassId, req.body.toAcademicYearId]
        );

        if (!fromClass.rows.length || !toClass.rows.length) {
          const error = new Error('Promotion classes must belong to the specified academic years');
          error.statusCode = 400;
          throw error;
        }

        const enrollments = await client.query(
          `SELECT e.student_id AS "studentId"
             FROM enrollments e
             JOIN students s ON s.id = e.student_id
            WHERE e.class_id = $1 AND e.status = 'active' AND s.status = 'active'`,
          [mapping.fromClassId]
        );

        let moved = 0;
        for (const enrollment of enrollments.rows) {
          if (req.body.excludeStudentIds.includes(enrollment.studentId)) continue;

          await client.query(
            `UPDATE enrollments SET status = 'completed', enrolled_at = enrolled_at
              WHERE student_id = $1 AND academic_year_id = $2 AND status = 'active'`,
            [enrollment.studentId, req.body.fromAcademicYearId]
          );
          await studentsRepository.moveEnrollment(
            enrollment.studentId,
            req.body.toAcademicYearId,
            mapping.toClassId,
            client
          );
          moved += 1;
        }

        countByClass[mapping.toClassId] = moved;
      }

      return countByClass;
    });

    return res.status(200).json({ countByClass: counts });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    return next(error);
  }
}

async function getOwnProfile(req, res, next) {
  try {
    const student = await studentsRepository.findByUserId(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student profile not found' });

    const guardians = await studentsRepository.listGuardians(student.id);
    const enrollments = await studentsRepository.listEnrollmentHistory(student.id);
    const currentEnrollment = enrollments.find((entry) => entry.status === 'active') || null;

    const current = await db.query(
      `SELECT ay.id AS "academicYearId", ay.name AS "academicYearName",
              ay.is_current AS "academicYearIsCurrent",
              t.id AS "termId", t.name AS "termName", t.is_current AS "termIsCurrent"
         FROM academic_years ay
         LEFT JOIN terms t ON t.academic_year_id = ay.id AND t.is_current = TRUE
        WHERE ay.is_current = TRUE LIMIT 1`
    );

    return res.status(200).json({
      student,
      guardians,
      currentClass: currentEnrollment,
      currentAcademicYear: current.rows[0]?.academicYearId ? current.rows[0] : null,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createStudent,
  listStudents,
  getStudent,
  updateStudent,
  addGuardian,
  updateGuardian,
  deleteGuardian,
  enrollStudent,
  promoteStudents,
  getOwnProfile,
};
