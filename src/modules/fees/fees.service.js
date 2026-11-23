const db = require('../../config/db');
const feesRepository = require('./fees.repository');

async function setManyClassFees(termId, fees, setBy) {
  return db.withTransaction(async (client) => {
    const term = await feesRepository.findTermById(termId, client);
    if (!term) {
      const error = new Error('Term not found');
      error.statusCode = 404;
      throw error;
    }

    for (const fee of fees) {
      const schoolClass = await feesRepository.findClassForTerm(
        fee.classId,
        term.academicYearId,
        client
      );

      if (!schoolClass) {
        const error = new Error('Every class must belong to the term academic year');
        error.statusCode = 400;
        throw error;
      }
    }

    for (const fee of fees) {
      await feesRepository.upsertClassFee(termId, fee.classId, fee.amount, setBy, client);
    }

    return feesRepository.listClassFees(termId, client);
  });
}

async function setStudentOverride(studentId, termId, amount, reason, setBy) {
  return db.withTransaction(async (client) => {
    const student = await client.query(
      'SELECT id FROM students WHERE id = $1',
      [studentId]
    );
    if (!student.rows.length) {
      const error = new Error('Student not found');
      error.statusCode = 404;
      throw error;
    }

    const term = await feesRepository.findTermById(termId, client);
    if (!term) {
      const error = new Error('Term not found');
      error.statusCode = 404;
      throw error;
    }

    await feesRepository.upsertOverride(studentId, termId, amount, reason, setBy, client);
    return feesRepository.findEffectiveFee(studentId, termId, client);
  });
}

module.exports = {
  setManyClassFees,
  setStudentOverride,
};
