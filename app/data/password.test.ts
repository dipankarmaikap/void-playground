import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { hashPassword, verifyPassword } from './password.ts';

describe('password', () => {
  it('verifies a password against its hash', () => {
    let hash = hashPassword('secret-password');
    assert.ok(hash.startsWith('scrypt$'));
    assert.equal(verifyPassword('secret-password', hash), true);
  });

  it('rejects a wrong password', () => {
    let hash = hashPassword('secret-password');
    assert.equal(verifyPassword('wrong-password', hash), false);
  });

  it('rejects malformed hashes', () => {
    assert.equal(verifyPassword('secret-password', ''), false);
    assert.equal(verifyPassword('secret-password', 'not-a-hash'), false);
    assert.equal(verifyPassword('secret-password', 'scrypt$only$two'), false);
    assert.equal(verifyPassword('secret-password', 'scrypt$$'), false);
  });

  it('produces different hashes for the same password', () => {
    assert.notEqual(hashPassword('same'), hashPassword('same'));
  });
});