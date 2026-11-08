import { describe, expect, it } from 'vitest';
import { cleanDisplayName, isEmail, passwordProblem, lockLeft, MAX_TRIES } from '../src/data/authRules';

describe('auth input rules', () => {
  it('accepts normal emails and rejects junk', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail(' me@example.com ')).toBe(true);
    for (const bad of ['', 'a', 'a@b', '@b.com', 'a b@c.com', 'a@b@c.com', 'x'.repeat(250) + '@b.com']) expect(isEmail(bad), bad).toBe(false);
  });
  it('passwords must be long enough, not trivial, and not contain the email name', () => {
    expect(passwordProblem('short1', 'a@b.co')).toMatch(/at least 10/);
    expect(passwordProblem('x'.repeat(80), 'a@b.co')).toMatch(/too long/);
    expect(passwordProblem('aaaaaaaaaaaa', 'a@b.co')).toMatch(/different/);
    expect(passwordProblem('password123', 'a@b.co')).toMatch(/common/);
    expect(passwordProblem('kenkenken123', 'ken@example.com')).toMatch(/email/);
    expect(passwordProblem('blue-kick-fast-7', 'ken@example.com')).toBe('');
  });
  it('display names are trimmed, short and free of control characters', () => {
    expect(cleanDisplayName('  Vihaan  ')).toBe('Vihaan');
    expect(cleanDisplayName('x'.repeat(50))).toHaveLength(20);
    expect(cleanDisplayName('a\u0000b\nc')).toBe('abc');
    expect(cleanDisplayName('   ')).toBe('');
  });
  it('locks sign-in for a minute after too many failed tries', () => {
    expect(lockLeft(MAX_TRIES - 1, 1000, 2000)).toBe(0);
    expect(lockLeft(MAX_TRIES, 1000, 1000)).toBe(60);
    expect(lockLeft(MAX_TRIES, 1000, 31000)).toBe(30);
    expect(lockLeft(MAX_TRIES, 1000, 70000)).toBe(0);
    expect(lockLeft(0, undefined, 5)).toBe(0);
  });
});
