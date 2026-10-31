import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

function bunPassword(): any {
  return (globalThis as any).Bun?.password;
}

export function hashPassword(password: string): string | Promise<string> {
  let bun = bunPassword();
  if (typeof bun?.hash === 'function') {
    return bun.hash(password);
  }
  let salt = randomBytes(16);
  let derived = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, hash: string): boolean | Promise<boolean> {
  let bun = bunPassword();
  if (typeof hash === 'string' && hash.startsWith('scrypt$')) {
    let parts = hash.split('$');
    if (parts.length !== 3) return false;
    let salt = Buffer.from(parts[1], 'hex');
    let expected = Buffer.from(parts[2], 'hex');
    if (salt.length === 0 || expected.length === 0) return false;
    let actual = scryptSync(password, salt, expected.length);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  }
  if (typeof bun?.verify === 'function') {
    try {
      return bun.verify(password, hash);
    } catch {
      return false;
    }
  }
  return false;
}

// Aliases for compatibility with common naming.
export const hash = hashPassword;
export const verify = verifyPassword;
export function createPasswordHash(password: string): string | Promise<string> {
  return hashPassword(password);
}
export function checkPassword(password: string, hash: string): boolean | Promise<boolean> {
  return verifyPassword(password, hash);
}

const password = {
  hash: hashPassword,
  verify: verifyPassword,
  hashPassword,
  verifyPassword,
};

export default password;
export { password };
