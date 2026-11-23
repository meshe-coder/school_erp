const db = require('../../config/db');
const billingRepository = require('./billing.repository');

async function generateBills(termId, refresh, createdBy) {
  return db.withTransaction(async (client) => {
    const term = await billingRepository.findTermById(termId, client);
    if (!term) {
      const error = new Error('Term not found');
      error.statusCode = 404;
      throw error;
    }

    const candidates = await billingRepository.findStudentsForBillGeneration(termId, client);
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let skippedNoFee = 0;

    for (const candidate of candidates) {
      if (!candidate.effectiveFee) {
        skippedNoFee += 1;
        continue;
      }

      const existing = await billingRepository.findBill(candidate.studentId, termId, client);

      if (!existing) {
        await billingRepository.createBill(
          candidate.studentId,
          termId,
          candidate.effectiveFee,
          createdBy,
          client
        );
        created += 1;
      } else if (refresh && existing.amount !== candidate.effectiveFee) {
        await billingRepository.refreshBill(existing.id, candidate.effectiveFee, client);
        updated += 1;
      } else {
        unchanged += 1;
      }
    }

    return { created, updated, unchanged, skippedNoFee };
  });
}

async function recordPayment(fields, recordedBy) {
  return db.withTransaction(async (client) => {
    let student = null;

    if (fields.studentId) {
      student = await billingRepository.findStudentById(fields.studentId, client);
    } else {
      student = await billingRepository.findStudentByAdmissionNumber(fields.admissionNumber, client);
    }

    if (!student) {
      const error = new Error('Student not found');
      error.statusCode = 404;
      throw error;
    }

    if (fields.paidAt) {
      const paidAt = new Date(fields.paidAt);
      if (Number.isNaN(paidAt.getTime())) {
        const error = new Error('Invalid paidAt date');
        error.statusCode = 400;
        throw error;
      }
      if (paidAt.getTime() > Date.now() + 5 * 60 * 1000) {
        const error = new Error('paidAt cannot be more than 5 minutes in the future');
        error.statusCode = 400;
        throw error;
      }
    }

    if (fields.reference) {
      const duplicate = await billingRepository.findDuplicateValidReference(
        fields.method,
        fields.reference,
        client
      );
      if (duplicate) {
        const error = new Error('Payment reference is already used by a valid payment');
        error.statusCode = 409;
        throw error;
      }
    }

    const payment = await billingRepository.createPayment(
      {
        ...fields,
        studentId: student.id,
        recordedBy,
      },
      client
    );

    const totals = await billingRepository.getPaymentTotals(student.id, client);
    return { payment, totals };
  });
}

async function reversePayment(paymentId, reversedBy, reason) {
  return db.withTransaction(async (client) => {
    const existing = await billingRepository.findPaymentById(paymentId, client);
    if (!existing) {
      const error = new Error('Payment not found');
      error.statusCode = 404;
      throw error;
    }
    if (existing.status === 'reversed') {
      const error = new Error('Payment is already reversed');
      error.statusCode = 409;
      throw error;
    }

    const payment = await billingRepository.reversePayment(paymentId, reversedBy, reason, client);
    const totals = await billingRepository.getPaymentTotals(existing.studentId, client);
    return { payment, totals };
  });
}

module.exports = { generateBills, recordPayment, reversePayment };
