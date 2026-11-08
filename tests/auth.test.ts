import { describe, expect, it } from 'vitest';
import { cleanDisplayName, isEmail, isOtp, cooldownLeft } from '../src/data/authRules';

describe('auth input rules', () => {
  it('accepts normal emails and rejects junk', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail(' me@example.com ')).toBe(true);
    for (const bad of ['', 'a', 'a@b', '@b.com', 'a b@c.com', 'a@b@c.com', 'x'.repeat(250) + '@b.com']) expect(isEmail(bad), bad).toBe(false);
  });
  it('codes are 6 to 8 digits', () => {
    expect(isOtp('123456')).toBe(true);
    expect(isOtp(' 123 456 ')).toBe(true);
    for (const bad of ['', '12345', 'abcdef', '123456789']) expect(isOtp(bad), bad).toBe(false);
  });
  it('display names are trimmed, short and free of control characters', () => {
    expect(cleanDisplayName('  Vihaan  ')).toBe('Vihaan');
    expect(cleanDisplayName('x'.repeat(50))).toHaveLength(20);
    expect(cleanDisplayName('a\u0000b\nc')).toBe('abc');
    expect(cleanDisplayName('   ')).toBe('');
  });
  it('resend cooldown counts down from the last send', () => {
    expect(cooldownLeft(1000, 1000)).toBe(60);
    expect(cooldownLeft(1000, 31000)).toBe(30);
    expect(cooldownLeft(1000, 100000)).toBe(0);
    expect(cooldownLeft(undefined, 5)).toBe(0);
  });
});
