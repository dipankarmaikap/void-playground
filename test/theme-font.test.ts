import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { fontAssetHref } from '../app/ui/theme.ts';
import { routes } from '../app/routes.ts';
import { createUserAndLogin, getHtml, origin } from './http.ts';
import { createTestRouter } from './router.ts';

const { router, db } = await createTestRouter();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fontStyleTag(html: string): { open: string; body: string } {
  for (let match of html.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/g)) {
    if (match[2].includes('@font-face')) return { open: match[0].slice(0, match[0].indexOf('>')), body: match[2] };
  }
  assert.fail('the document should declare an @font-face rule');
}

describe('Inter typography on rendered pages', () => {
  it('serves the local WOFF2 asset as a font', async () => {
    let response = await router.fetch(new URL(fontAssetHref, origin));

    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type') ?? '', /font\/woff2/);
    let bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(new TextDecoder().decode(bytes.subarray(0, 4)), 'wOF2', 'a real WOFF2 file is committed');
  });

  it('declares a nonce-protected font face and preload without a third-party stylesheet', async () => {
    let response = await router.fetch(new URL(routes.home.href(), origin));
    let policy = response.headers.get('Content-Security-Policy') ?? '';
    let nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
    assert.ok(nonce, 'the CSP should carry a request nonce');

    let html = await response.text();
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);

    let style = fontStyleTag(html);
    assert.match(style.open, new RegExp(`nonce="${escapeRegExp(nonce)}"`));
    assert.match(style.body, /font-family:\s*"Inter",\s*"Segoe UI",\s*sans-serif/);
    assert.match(style.body, new RegExp(`src:\\s*url\\(['"]?${escapeRegExp(fontAssetHref)}`));

    assert.match(html, /<link\b[^>]*rel="preload"[^>]*as="font"[^>]*>/);
    assert.match(html, new RegExp(`href="${escapeRegExp(fontAssetHref)}"`));
    assert.match(html, /crossorigin/);
  });

  it('applies the Inter stack to authenticated pages and their form controls', async () => {
    let sessionCookie = await createUserAndLogin(router, db, 'theme-font');
    let html = await getHtml(router, routes.app.clients.new.href(), sessionCookie);

    assert.match(html, /font-family:\s*"Inter",\s*"Segoe UI",\s*sans-serif/);
    assert.match(html, new RegExp(`href="${escapeRegExp(fontAssetHref)}"`));
  });
});
