import { createServer } from 'node:http';

import * as assert from 'remix/assert';
import { createRequestListener } from 'remix/node-fetch-server';
import type { RequestListenerOptions } from 'remix/node-fetch-server';
import { describe, it } from 'remix/test';

import { router } from '../app/router.ts';
import { routes } from '../app/routes.ts';
import { getNodeRequestListenerOptions } from '../app/server-config.ts';
import { cookieFromResponse, extractCsrf } from './http.ts';

interface RunningServer {
  url: string;
  close: () => Promise<void>;
}

async function listen(
  handler: (request: Request) => Response | Promise<Response>,
  options: RequestListenerOptions,
): Promise<RunningServer> {
  let server = createServer(createRequestListener(handler, options));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  let address = server.address();
  assert.ok(address && typeof address === 'object');

  return {
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      let closed = new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
      await closed;
    },
  };
}

async function exerciseRegistrationOrigin(
  options: RequestListenerOptions,
  publicOrigin: string,
  forwardedHeaders: Record<string, string>,
) {
  let server = await listen(router.fetch, options);
  let originalLog = console.log;
  let logLines: unknown[][] = [];

  try {
    console.log = (...values: unknown[]) => logLines.push(values);
    let page = await fetch(`${server.url}${routes.auth.register.index.href()}`, {
      headers: forwardedHeaders,
    });
    let html = await page.text();
    let cookie = cookieFromResponse(page);
    let csrf = extractCsrf(html);

    assert.equal(page.status, 200);
    assert.ok(cookie);
    assert.match(page.headers.get('Set-Cookie') ?? '', /;\s*Secure(?:;|$)/i);

    let response = await fetch(`${server.url}${routes.auth.register.action.href()}`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        ...forwardedHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: publicOrigin,
        Cookie: cookie,
      },
      body: new URLSearchParams({
        email: `origin-${crypto.randomUUID()}@example.com`,
        organization_name: 'Origin Test Studio',
        password: 'password123',
        _csrf: csrf,
      }).toString(),
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), routes.auth.login.index.href());
    assert.ok(
      logLines.some(([line]) => typeof line === 'string' && line.startsWith(`${publicOrigin}/verify?token=`)),
      'the verification link should use the public origin',
    );
  } finally {
    console.log = originalLog;
    await server.close();
  }
}

describe('deployment origin configuration', () => {
  it('uses a configured canonical HTTPS origin and ignores forwarded host spoofing', async () => {
    let publicOrigin = 'https://app.example.test';
    let options = getNodeRequestListenerOptions({
      NODE_ENV: 'production',
      PUBLIC_ORIGIN: publicOrigin,
    });

    await exerciseRegistrationOrigin(options, publicOrigin, {
      'X-Forwarded-Host': 'attacker.example',
      'X-Forwarded-Proto': 'http',
    });
  });

  it('trusts forwarded origin headers only in explicitly configured proxy mode', async () => {
    let publicOrigin = 'https://proxy.example.test';
    let options = getNodeRequestListenerOptions({
      NODE_ENV: 'production',
      TRUST_PROXY: 'true',
    });

    await exerciseRegistrationOrigin(options, publicOrigin, {
      'X-Forwarded-Host': 'proxy.example.test',
      'X-Forwarded-Proto': 'https',
    });
  });

  it('requires an explicit public-origin mode in production', () => {
    assert.throws(
      () => getNodeRequestListenerOptions({ NODE_ENV: 'production' }),
      /PUBLIC_ORIGIN|TRUST_PROXY/,
    );
    assert.throws(
      () =>
        getNodeRequestListenerOptions({
          NODE_ENV: 'production',
          PUBLIC_ORIGIN: 'http://app.example.test',
        }),
      /HTTPS/,
    );
    assert.throws(
      () =>
        getNodeRequestListenerOptions({
          NODE_ENV: 'production',
          PUBLIC_ORIGIN: 'https://app.example.test',
          TRUST_PROXY: 'true',
        }),
      /only one/i,
    );
  });
});
