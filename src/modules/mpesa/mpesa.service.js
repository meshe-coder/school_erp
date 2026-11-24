const mpesaClient = require('./mpesa.client');
const mpesaConfig = require('./mpesa.config');
const mpesaRepo = require('./mpesa.repository');
const db = require('../../config/db');

/**
 * Service layer for M-Pesa STK Push operations and callback handling.
 * Structured cleanly and simply so interns can easily read and maintain it.
 */
class MpesaService {
  /**
   * Initiates an STK Push payment request to a student's phone.
   */
  async initiateSTKPush({ studentId, amount, phone }) {
    if (amount < mpesaConfig.amounts.min || amount > mpesaConfig.amounts.max) {
      throw new Error(`Amount must be between ${mpesaConfig.amounts.min} and ${mpesaConfig.amounts.max} KES`);
    }

    const formattedPhone = this._formatPhoneNumber(phone);

    // Track request in database
    const request = await mpesaRepo.createRequest({
      checkoutRequestId: '',
      studentId,
      amount,
      phone: formattedPhone,
      status: 'pending',
    });

    // Send request to Safaricom Daraja API
    const safaricomResponse = await mpesaClient.stkPush({
      phone: formattedPhone,
      amount,
      accountReference: mpesaConfig.accountReference,
      transactionDescription: mpesaConfig.transactionDescription,
    });

    if (safaricomResponse.CheckoutRequestID) {
      await mpesaRepo.updateStatus(safaricomResponse.CheckoutRequestID, 'sent');
      request.checkoutRequestId = safaricomResponse.CheckoutRequestID;
    }

    return {
      requestId: request.id,
      checkoutRequestId: request.checkoutRequestId,
      status: request.status,
      studentId,
      amount,
      phone: formattedPhone,
      safaricomResponse,
    };
  }

  /**
   * Handles inbound callback notifications from Safaricom.
   * Note: Failed/cancelled transactions do not send CallbackMetadata.
   */
  async handleCallback(reqBody) {
    const stkCallback = reqBody && reqBody.Body && reqBody.Body.StkCallback;
    if (!stkCallback) {
      throw new Error('Invalid M-Pesa callback payload structure');
    }

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;
    const callbackMetadata = stkCallback.CallbackMetadata;

    if (!checkoutRequestId || resultCode === undefined) {
      throw new Error('Missing required callback fields');
    }

    // Update request status in database
    const newStatus = resultCode === 0 ? 'completed' : 'failed';
    await mpesaRepo.updateStatus(checkoutRequestId, newStatus);

    // If successful, extract transaction receipt and record payment
    if (resultCode === 0 && callbackMetadata && callbackMetadata.Item) {
      const metadata = this._parseCallbackItems(callbackMetadata.Item);

      if (metadata.phoneNumber && metadata.receiptNumber) {
        const studentId = await this._findStudentByPhone(metadata.phoneNumber);

        if (studentId) {
          await db.query(
            `INSERT INTO payments
               (student_id, amount, method, mpesa_receipt, phone, status, paid_at, raw_payload)
             VALUES ($1, $2::NUMERIC(12,2), 'mpesa_stk', $3, $4, 'completed', NOW(), $5)
             ON CONFLICT (mpesa_receipt) DO NOTHING`,
            [
              studentId,
              metadata.amount || 0,
              metadata.receiptNumber,
              metadata.phoneNumber,
              JSON.stringify(reqBody),
            ]
          );
        }
      }
    }

    return {
      resultCode,
      resultDesc,
      checkoutRequestId,
      newStatus,
      paymentRecorded: resultCode === 0 ? 'yes' : 'no',
    };
  }

  /**
   * Queries Safaricom for the status of an STK Push request.
   */
  async queryStkPush({ checkoutRequestId }) {
    return await mpesaClient.queryStkPush({ checkoutRequestId });
  }

  /**
   * Helper to parse callback items into a key-value object.
   */
  _parseCallbackItems(items) {
    const data = {};
    for (const item of items) {
      switch (item.Name) {
        case 'MpesaReceiptNumber':
        case 'ReceiptNumber':
          data.receiptNumber = item.Value;
          break;
        case 'Amount':
          data.amount = item.Value;
          break;
        case 'PhoneNumber':
          data.phoneNumber = String(item.Value);
          break;
      }
    }
    return data;
  }

  /**
   * Helper to format phone numbers into 254XXXXXXXXX format.
   */
  _formatPhoneNumber(phone) {
    const cleaned = String(phone).trim();
    if (cleaned.startsWith('254')) return cleaned;
    if (cleaned.startsWith('07') || cleaned.startsWith('01')) {
      return '254' + cleaned.slice(1);
    }
    return '254' + cleaned;
  }

  /**
   * Helper to find a student ID by phone number.
   */
  async _findStudentByPhone(phoneNumber) {
    const formatted = this._formatPhoneNumber(phoneNumber);
    const result = await db.query(
      `SELECT id FROM students WHERE guardian_phone = $1 OR phone = $1 LIMIT 1`,
      [formatted]
    );
    return result.rows.length > 0 ? result.rows[0].id : null;
  }
}

module.exports = new MpesaService();

