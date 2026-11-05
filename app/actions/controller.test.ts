import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { router } from '../router.ts';
import { routes } from '../routes.ts';

describe('root controller', () => {
  it('GET / returns the home page', async () => {
    let response = await router.fetch(new URL(routes.home.href(), 'http://localhost'));

    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/);
    assert.match(await response.text(), /<html[\s>]/);
  });

  it('GET / applies a nonce-based content security policy', async () => {
    let response = await router.fetch(new URL(routes.home.href(), 'http://localhost'));
    let policy = response.headers.get('Content-Security-Policy') ?? '';
    let nonce = /'nonce-([^']+)'/.exec(policy)?.[1];

    assert.ok(nonce, 'the policy should include a nonce');
    assert.match(policy, /script-src 'nonce-/);
    assert.match(policy, /style-src 'nonce-/);

    let html = await response.text();
    assert.match(html, new RegExp(`<script type="module"[^>]*nonce="${nonce}"`));
  });
});