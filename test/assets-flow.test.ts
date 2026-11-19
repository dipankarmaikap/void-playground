import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { assets } from '../app/assets.ts';
import { sessions, users } from '../app/data/db.ts';
import { createTestRouter } from './router.ts';
import { createUserAndLogin, origin } from './http.ts';

const { router, db } = await createTestRouter();

describe('source asset requests', () => {
  it('serves assets anonymously and skips Session and User database lookups', async () => {
    let assetHref = await assets.getHref('app/actions/public/entry.ts');
    let assetUrl = new URL(assetHref, origin);
    let anonymous = await router.fetch(assetUrl);
    assert.equal(anonymous.status, 200);
    assert.doesNotMatch(anonymous.headers.get('Cache-Control') ?? '', /private|no-store/i);

    let sessionCookie = await createUserAndLogin(router, db, 'asset');
    let lookups: unknown[] = [];
    let originalFind = db.find;

    db.find = new Proxy(originalFind, {
      apply(target, thisArg, args) {
        if (args[0] === sessions || args[0] === users) {
          lookups.push(args[0]);
        }
        return Reflect.apply(target, thisArg, args);
      },
    });

    try {
      let authenticated = await router.fetch(assetUrl, {
        headers: { Cookie: sessionCookie },
      });
      let assetBase = await router.fetch(new URL('/assets', origin), {
        headers: { Cookie: sessionCookie },
      });

      assert.equal(authenticated.status, 200);
      assert.equal(assetBase.status, 404);
      assert.doesNotMatch(
        authenticated.headers.get('Cache-Control') ?? '',
        /private|no-store/i,
      );
      assert.equal(lookups.length, 0, 'asset requests must bypass Session and Auth database reads');
    } finally {
      db.find = originalFind;
    }
  });
});
