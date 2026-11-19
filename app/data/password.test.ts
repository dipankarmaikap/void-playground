import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { hashPassword, verifyPassword } from './password.ts';

describe('password', () => {
  it('verifies a password against its hash', async () => {
    let hash = await hashPassword('secret-password');
    let [prefix, iterations, salt, digest] = hash.split('$');
    assert.equal(prefix, 'pbkdf2_sha256');
    assert.equal(iterations, '100000', 'the encoded hash records the fixed iteration count');
    assert.ok(salt.length > 0, 'the encoded hash carries a salt');
    assert.ok(digest.length > 0, 'the encoded hash carries a digest');
    assert.equal(await verifyPassword('secret-password', hash), true);
  });

  it('rejects a wrong password', async () => {
    let hash = await hashPassword('secret-password');
    assert.equal(await verifyPassword('wrong-password', hash), false);
  });

  it('rejects malformed hashes', async () => {
    assert.equal(await verifyPassword('secret-password', ''), false);
    assert.equal(await verifyPassword('secret-password', 'not-a-hash'), false);
    assert.equal(await verifyPassword('secret-password', 'pbkdf2_sha256$only$two'), false);
    assert.equal(await verifyPassword('secret-password', 'pbkdf2_sha256$abc$salt$digest'), false);
    assert.equal(await verifyPassword('secret-password', 'pbkdf2_sha256$0$salt$digest'), false);
    assert.equal(await verifyPassword('secret-password', 'pbkdf2_sha256$100000$only'), false);
    assert.equal(await verifyPassword('secret-password', 'pbkdf2_sha256$100000$$digest'), false);
  });

  it('produces different hashes for the same password', async () => {
    assert.notEqual(await hashPassword('same'), await hashPassword('same'));
  });
});
