const https = require('https');
const config = require('./mpesa.config');

/**
 * Clean HTTPS client for interacting with Safaricom Daraja API.
 * Handles OAuth authentication token generation, STK Push, and transaction status queries.
 */
class MpesaClient {
  constructor() {
    this.tokenCache = null;
    this.tokenExpiry = 0;
  }

  /**
   * Generates or retrieves a cached OAuth access token from Safaricom.
   * Tokens are cached for 55 minutes (they expire in 60 minutes).
   */
  async generateToken() {
    const now = Date.now();
    if (this.tokenCache && this.tokenExpiry > now) {
      return this.tokenCache;
    }

    const authCredentials = Buffer.from(
      `${config.consumerKey}:${config.consumerSecret}`
    ).toString('base64');

    const response = await this._makeRequest(config.endpoints.token, {
      method: 'GET',
      headers: { Authorization: `Basic ${authCredentials}` },
      timeout: config.timeouts.token,
    });

    const body = JSON.parse(response);
    if (!body.access_token) {
      throw new Error(`Failed to obtain M-Pesa access token: ${response}`);
    }

    this.tokenCache = body.access_token;
    this.tokenExpiry = now + 55 * 60 * 1000; // 55 minutes cache
    return this.tokenCache;
  }

  /**
   * Initiates an STK Push (Lipa Na M-Pesa Online) prompt to the user's phone.
   */
  async stkPush({ phone, amount, accountReference, transactionDescription }) {
    const token = await this.generateToken();
    const timestamp = this._generateTimestamp();
    const password = this._generatePassword(timestamp);

    const payload = {
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: config.transType,
      Amount: amount,
      PartyA: phone,
      PartyB: config.shortcode,
      PhoneNumber: phone,
      CallBackURL: config.callbackUrl,
      AccountReference: accountReference || config.accountReference,
      TransactionDesc: transactionDescription || config.transactionDescription,
    };

    const response = await this._makeRequest(config.endpoints.stkPush, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      timeout: config.timeouts.stkPush,
    });

    return JSON.parse(response);
  }

  /**
   * Queries the status of an ongoing or completed STK Push request.
   */
  async queryStkPush({ checkoutRequestId }) {
    const token = await this.generateToken();
    const timestamp = this._generateTimestamp();
    const password = this._generatePassword(timestamp);

    const payload = {
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    const response = await this._makeRequest(config.endpoints.query, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      timeout: config.timeouts.stkPush,
    });

    return JSON.parse(response);
  }

  /**
   * Generates the Base64 encoded Safaricom password.
   */
  _generatePassword(timestamp) {
    const rawString = `${config.shortcode}${config.passkey}${timestamp}`;
    return Buffer.from(rawString).toString('base64');
  }

  /**
   * Generates a timestamp in YYYYMMDDHHmmss format.
   */
  _generateTimestamp() {
    const date = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    return (
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  }

  /**
   * Low-level HTTPS request helper with error and timeout handling.
   */
  _makeRequest(endpointPath, options) {
    return new Promise((resolve, reject) => {
      const targetUrl = new URL(config.baseUrl + endpointPath);

      const req = https.request(
        {
          hostname: targetUrl.hostname,
          port: targetUrl.port || 443,
          path: targetUrl.pathname + targetUrl.search,
          method: options.method,
          headers: options.headers,
          timeout: options.timeout,
        },
        (res) => {
          let responseData = '';
          res.on('data', (chunk) => (responseData += chunk));
          res.on('end', () => {
            if (res.statusCode >= 400) {
              reject(new Error(`Safaricom API error (${res.statusCode}): ${responseData}`));
            } else {
              resolve(responseData);
            }
          });
        }
      );

      req.on('error', (err) => reject(new Error(`Safaricom network error: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Safaricom API request timed out'));
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }
}

module.exports = new MpesaClient();

