const db = require('../../config/db');
const billingRepository = require('./billing.repository');
const billingService = require('./billing.service');

async function generateBills(req, res, next) {
  try {
    const result = await billingService.generateBills(
      req.params.termId,
      req.body.refresh,
      req.user.id
    );
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    return next(error);
  }
}

async function listBills(req, res, next) {
  try {
    const term = await billingRepository.findTermById(req.params.termId);
    if (!term) return res.status(404).json({ error: 'Term not found' });

    const result = await billingRepository.listTermBills(req.params.termId, req.query);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

async function createPayment(req, res, next) {
  try {
    const result = await billingService.recordPayment(req.body, req.user.id);
    return res.status(201).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === '23505') return res.status(409).json({ error: 'Payment reference is already used by a valid payment' });
    return next(error);
  }
}

async function listPayments(req, res, next) {
  try {
    const result = await billingRepository.listPayments(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

async function reversePayment(req, res, next) {
  try {
    const result = await billingService.reversePayment(
      req.params.id,
      req.user.id,
      req.body.reason
    );
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    return next(error);
  }
}

async function getAdminStudentStatement(req, res, next) {
  try {
    const student = await billingRepository.findStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const statement = await billingRepository.getStudentStatement(req.params.id);
    return res.status(200).json(statement);
  } catch (error) {
    return next(error);
  }
}

async function getOwnStudentStatement(req, res, next) {
  try {
    const result = await db.query(
      'SELECT id FROM students WHERE user_id = $1',
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(200).json({
        student: null,
        bills: [],
        payments: [],
        totals: {
          totalBilled: '0.00',
          totalPaid: '0.00',
          balance: '0.00',
          credit: '0.00',
        },
      });
    }

    const statement = await billingRepository.getStudentStatement(result.rows[0].id);
    statement.payments = statement.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference,
      paidAt: payment.paidAt,
      status: payment.status,
      reversedAt: payment.reversedAt,
    }));

    return res.status(200).json(statement);
  } catch (error) {
    return next(error);
  }
}

async function getBalances(req, res, next) {
  try {
    const result = await billingRepository.listBalances(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

async function getDashboard(req, res, next) {
  try {
    const result = await billingRepository.getDashboard();
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  generateBills,
  listBills,
  createPayment,
  listPayments,
  reversePayment,
  getAdminStudentStatement,
  getOwnStudentStatement,
  getBalances,
  getDashboard,
};
