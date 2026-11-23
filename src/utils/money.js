const { z } = require('zod');

const MAX_AMOUNT = 99999999.99;

function normalizeMoney(value, allowZero) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('Amount must be a number or string');
  }

  const text = String(value).trim();

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error('Amount must have at most 2 decimal places');
  }

  const [wholePart, decimalPart = ''] = text.split('.');
  const normalizedWhole = wholePart.replace(/^0+(?=\d)/, '');
  const normalizedDecimal = decimalPart.padEnd(2, '0');
  const normalized = `${normalizedWhole}.${normalizedDecimal}`;

  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue) || numericValue > MAX_AMOUNT) {
    throw new Error('Amount exceeds the maximum allowed value');
  }
  if (!allowZero && numericValue === 0) {
    throw new Error('Amount must be greater than 0');
  }

  return normalized;
}

function createMoneySchema(allowZero) {
  return z.union([z.number(), z.string()]).transform((value, context) => {
    try {
      return normalizeMoney(value, allowZero);
    } catch (error) {
      context.addIssue({
        code: 'custom',
        message: error.message,
      });
      return z.NEVER;
    }
  });
}

const moneySchema = createMoneySchema(false);
const moneyOrZeroSchema = createMoneySchema(true);

module.exports = {
  moneySchema,
  moneyOrZeroSchema,
  normalizeMoney,
};
