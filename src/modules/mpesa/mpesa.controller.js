const mpesaService = require('./mpesa.service');
const db = require('../../config/db');
const billingRepository = require('../billing/billing.repository');

/**
 * Controller for M-Pesa STK Push endpoints.
 */

async function initiateSTKPush(req, res, next) {
  try {
    const { studentId, amount, phone } = req.body;

    if (!studentId || !amount || !phone) {
      return res.status(400).json({ error: 'studentId, amount, and phone are required' });
    }

    // Verify student exists
    const student = await db.query('SELECT id FROM students WHERE id = $1', [studentId]);
    if (!student.rows.length) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const result = await mpesaService.initiateSTKPush({ studentId, amount, phone });
    return res.status(201).json(result);
  } catch (error) {
    if (error.message.includes('Amount must be between')) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
}

async function handleCallback(req, res, next) {
  try {
    // This endpoint is public (no auth) - Safaricom calls it directly
    // Log the full payload for debugging
    console.log('M-Pesa Callback received:', JSON.stringify(req.body, null, 2));

    const result = await mpesaService.handleCallback(req.body);

    // Safaricom expects a 200 response within 10 seconds
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback received' });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    // Still return 200 to Safaricom to avoid retries (but log the error)
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback received with errors' });
  }
}

async function querySTKStatus(req, res, next) {
  try {
    const { checkoutRequestId } = req.params;

    if (!checkoutRequestId) {
      return res.status(400).json({ error: 'checkoutRequestId is required' });
    }

    const status = await mpesaService.queryStkPush({ checkoutRequestId });
    return res.status(200).json(status);
  } catch (error) {
    return next(error);
  }
}

async function listRequests(req, res, next) {
  try {
    const { studentId, status, page = 1, limit = 20 } = req.query;
    
    let query = 'SELECT * FROM mpesa_requests WHERE 1=1';
    const params = [];
    
    if (studentId) {
      params.push(studentId);
      query += ` AND student_id = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const limitNum = Math.min(Number(limit), 100);
    const offset = (Number(page) - 1) * limitNum;
    
    params.push(limitNum);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;
    
    const result = await db.query(query, params);
    
    // Count total
    let countQuery = 'SELECT COUNT(*) FROM mpesa_requests WHERE 1=1';
    const countParams = params.slice(0, -2);
    if (studentId) countQuery += ' AND student_id = $1';
    if (status) countQuery += ` AND status = $${countParams.length + 1}`;
    
    const countResult = await db.query(countQuery, countParams);
    
    return res.status(200).json({
      data: result.rows,
      page: Number(page),
      limit: limitNum,
      total: parseInt(countResult.rows[0].count, 10),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  initiateSTKPush,
  handleCallback,
  querySTKStatus,
  listRequests,
};
