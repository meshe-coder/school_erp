function normalizePhone(input) {
  if (typeof input !== 'string') {
    throw new Error('Phone number must be a string');
  }

  let digits = input.trim().replace(/[\s-]/g, '').replace(/\(.*?\)/g, '');

  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }

  if (digits.startsWith('0')) {
    digits = `254${digits.slice(1)}`;
  } else if (!digits.startsWith('254')) {
    throw new Error('Invalid Kenyan mobile phone number');
  }

  if (!/^254(?:7\d{8}|1\d{8})$/.test(digits)) {
    throw new Error('Invalid Kenyan mobile phone number');
  }

  return digits;
}

module.exports = { normalizePhone };
