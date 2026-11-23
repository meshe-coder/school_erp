const { moneySchema, moneyOrZeroSchema } = require('../src/utils/money');

describe('moneySchema', () => {
  test.each([
    ['12000', '12000.00'],
    [12000, '12000.00'],
    ['12000.5', '12000.50'],
    ['12000.50', '12000.50'],
  ])('accepts and normalizes %p', (input, expected) => {
    const result = moneySchema.safeParse(input);
    expect(result.success).toBe(true);
    expect(result.data).toBe(expected);
  });

  test.each(['-5', '10.999', 'abc', '', '1e21'])('rejects %p', (input) => {
    expect(moneySchema.safeParse(input).success).toBe(false);
  });

  test('rejects 0', () => {
    expect(moneySchema.safeParse('0').success).toBe(false);
  });

  test('rejects values above the maximum', () => {
    expect(moneySchema.safeParse('100000000.00').success).toBe(false);
  });
});

describe('moneyOrZeroSchema', () => {
  test('accepts 0', () => {
    const result = moneyOrZeroSchema.safeParse('0');
    expect(result.success).toBe(true);
    expect(result.data).toBe('0.00');
  });

  test('normalizes positive override amounts', () => {
    const result = moneyOrZeroSchema.safeParse('2500.5');
    expect(result.success).toBe(true);
    expect(result.data).toBe('2500.50');
  });

  test.each(['-5', '10.999', 'abc', '', '100000000.00'])('rejects %p', (input) => {
    expect(moneyOrZeroSchema.safeParse(input).success).toBe(false);
  });
});
