import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  let salt = randomBytes(16);
  let derived = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  if (typeof hash !== 'string' || !hash.startsWith('scrypt$')) {
    return false;
  }

  let parts = hash.split('$');
  if (parts.length !== 3) {
    return false;
  }

  let salt = Buffer.from(parts[1], 'hex');
  let expected = Buffer.from(parts[2], 'hex');
  if (salt.length === 0 || expected.length === 0) {
    return false;
  }

  let actual = scryptSync(password, salt, expected.length);
  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
