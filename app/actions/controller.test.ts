import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { createUser, login, origin } from '../../test/http.ts';
import { createTestRouter } from '../../test/router.ts';
import { routes } from '../routes.ts';

const { router, db } = await createTestRouter();

describe('root controller', () => {
  it('GET / returns the home page', async () => {
    let response = await router.fetch(new URL(routes.home.href(), 'http://localhost'));

    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/);
    assert.match(await response.text(), /<html[\s>]/);
  });

  it('returns Method Not Allowed for unsupported home-page methods', async () => {
    let head = await router.fetch(new URL(routes.home.href(), origin), { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');

    for (let method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      let response = await router.fetch(new URL(routes.home.href(), origin), { method });
      assert.equal(response.status, 405, `${method} / should not return a successful page`);
      assert.equal(response.headers.get('Allow'), 'GET, HEAD');
    }
  });

  it('GET / gives anonymous visitors a titled, descriptive home page', async () => {
    let response = await router.fetch(new URL(routes.home.href(), origin));
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.doesNotMatch(response.headers.get('Cache-Control') ?? '', /private|no-store/i);
    assert.match(html, /<title>Home \| My Remix App<\/title>/);
    assert.match(html, /<meta name="description" content="Welcome to My Remix App\./);
    assert.doesNotMatch(html, /<meta name="robots" content="noindex"/);
  });

  it('GET / offers anonymous visitors registration and login actions', async () => {
    let response = await router.fetch(new URL(routes.home.href(), origin));
    let html = await response.text();

    assert.match(html, /<a[^>]*href="\/register"[^>]*>Create account<\/a>/);
    assert.match(html, /<a[^>]*href="\/login"[^>]*>Log in<\/a>/);
  });

  it('GET / exposes social-preview metadata', async () => {
    let response = await router.fetch(new URL(routes.home.href(), origin));
    let html = await response.text();

    assert.match(html, /<meta property="og:type" content="website"/);
    assert.match(html, /<meta property="og:site_name" content="My Remix App"/);
    assert.match(html, /<meta property="og:title" content="Home \| My Remix App"/);
    assert.match(html, /<meta property="og:description" content="[^"]*My Remix App/);
    assert.match(html, /<meta name="twitter:card" content="summary"/);
    assert.match(html, /<meta name="twitter:title" content="Home \| My Remix App"/);
    assert.match(html, /<meta name="twitter:description" content="[^"]*My Remix App/);
  });

  it('GET / remains public for an authenticated user and links to every destination', async () => {
    let email = `home-${crypto.randomUUID()}@example.com`;
    await createUser(db, email, 'password123');
    let sessionCookie = await login(router, email, 'password123');

    let response = await router.fetch(new URL(routes.home.href(), origin), {
      headers: { Cookie: sessionCookie },
    });
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.doesNotMatch(response.headers.get('Cache-Control') ?? '', /private|no-store/i);
    assert.match(html, /<title>Home \| My Remix App<\/title>/);
    assert.match(html, /<a[^>]*href="\/app\/dashboard"[^>]*>Go to dashboard<\/a>/);
    assert.match(html, /<a[^>]*href="\/register"[^>]*>Create account<\/a>/);
    assert.match(html, /<a[^>]*href="\/login"[^>]*>Log in<\/a>/);
    assert.doesNotMatch(html, /href="\/app\/settings"/);
  });

  it('GET / applies a nonce-based content security policy', async () => {
    let response = await router.fetch(new URL(routes.home.href(), 'http://localhost'));
    let policy = response.headers.get('Content-Security-Policy') ?? '';
    let nonce = /'nonce-([^']+)'/.exec(policy)?.[1];

    assert.ok(nonce, 'the policy should include a nonce');
    assert.match(policy, /script-src 'nonce-/);
    assert.match(policy, /style-src 'nonce-/);

    let html = await response.text();
    let escapedNonce = nonce.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(html, new RegExp(`<script type="module"[^>]*nonce="${escapedNonce}"`));

    let preloads = [...html.matchAll(/<link\b[^>]*rel="modulepreload"[^>]*>/g)].map(
      ([tag]) => tag,
    );
    assert.ok(preloads.length > 0, 'the document should preload its client module graph');
    for (let preload of preloads) {
      assert.match(
        preload,
        new RegExp(`nonce="${escapedNonce}"`),
        'every module preload should carry the response nonce',
      );
    }
  });
});
