const { normalizePhone } = require('../src/utils/phone');

describe('normalizePhone', () => {
  test.each([
    ['0712345678', '254712345678'],
    ['+254712345678', '254712345678'],
    ['254712345678', '254712345678'],
    ['0112345678', '254112345678'],
    ['0712-345-678', '254712345678'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  test.each([
    '071234567',
    '123456789',
    '254812345678',
    'not-a-phone',
    '+25471234567!',
    '',
  ])('rejects invalid phone %s', (input) => {
    expect(() => normalizePhone(input)).toThrow('Invalid Kenyan mobile phone number');
  });

  test('rejects non-string input', () => {
    expect(() => normalizePhone(712345678)).toThrow('Phone number must be a string');
  });
});
