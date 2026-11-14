import { createServer, get } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { getShutdownGracePeriodMs } from '../app/server-config.ts';
import { createShutdownHandler } from '../app/server-shutdown.ts';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function listen(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<{ server: Server; url: string }> {
  let server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  let address = server.address();
  assert.ok(address && typeof address === 'object');
  return { server, url: `http://127.0.0.1:${address.port}` };
}

function getBody(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    let request = get(url, { headers: { Connection: 'close' } }, (response) => {
      response.setEncoding('utf8');
      let body = '';
      response.on('data', (chunk: string) => (body += chunk));
      response.on('end', () => resolve(body));
    });
    request.on('error', () => resolve(null));
  });
}

async function closeForTest(server: Server) {
  if (!server.listening) return;
  let closed = new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
  await closed;
}

describe('graceful server shutdown', () => {
  it('drains an active request before closing resources and runs only once', async () => {
    let started = deferred<void>();
    let release = deferred<void>();
    let requestFinished = false;
    let serverResult = await listen((_request, response) => {
      started.resolve();
      release.promise.then(() => {
        response.end('finished', () => {
          requestFinished = true;
        });
      });
    });
    let response = getBody(`${serverResult.url}/in-flight`);
    await started.promise;

    let resourceCloseCount = 0;
    let resourcesClosedAfterDrain = false;
    let forceCloseCalled = false;
    let exitCode = 0;
    let errors: unknown[] = [];
    let shutdown = createShutdownHandler(
      {
        close: serverResult.server.close.bind(serverResult.server),
        closeAllConnections() {
          forceCloseCalled = true;
          serverResult.server.closeAllConnections();
        },
      },
      [
        async () => {
          resourceCloseCount += 1;
          resourcesClosedAfterDrain = requestFinished;
        },
      ],
      {
        gracePeriodMs: 500,
        onError: (error) => errors.push(error),
        setExitCode: (code) => (exitCode = code),
      },
    );

    try {
      let shuttingDown = shutdown();
      assert.equal(shutdown(), shuttingDown, 'repeated shutdown signals share one operation');
      release.resolve();

      assert.equal(await response, 'finished');
      await shuttingDown;

      assert.equal(resourceCloseCount, 1);
      assert.equal(resourcesClosedAfterDrain, true);
      assert.equal(forceCloseCalled, false);
      assert.equal(exitCode, 0);
      assert.equal(errors.length, 0);
    } finally {
      release.resolve();
      await closeForTest(serverResult.server);
    }
  });

  it('force-closes an in-flight request only after the grace period', async () => {
    let started = deferred<void>();
    let serverResult = await listen((_request, _response) => {
      started.resolve();
    });
    let response = getBody(`${serverResult.url}/stalled`);
    await started.promise;

    let resourceCloseCount = 0;
    let forceCloseCalled = false;
    let shutdownStartedAt = Date.now();
    let shutdown = createShutdownHandler(
      {
        close: serverResult.server.close.bind(serverResult.server),
        closeAllConnections() {
          forceCloseCalled = true;
          serverResult.server.closeAllConnections();
        },
      },
      [
        async () => {
          resourceCloseCount += 1;
        },
      ],
      {
        gracePeriodMs: 25,
        onError() {},
        setExitCode() {},
      },
    );

    try {
      await shutdown();
      assert.equal(await response, null, 'the stalled client request should be disconnected');
      assert.equal(forceCloseCalled, true);
      assert.ok(Date.now() - shutdownStartedAt >= 25);
      assert.equal(resourceCloseCount, 1);
    } finally {
      await closeForTest(serverResult.server);
    }
  });

  it('reports resource cleanup failures and sets a failing exit code', async () => {
    let serverResult = await listen((_request, response) => response.end('ok'));
    let errors: unknown[] = [];
    let exitCode = 0;
    let successfulCloseCount = 0;
    let shutdown = createShutdownHandler(
      serverResult.server,
      [
        async () => {
          throw new Error('asset close failed');
        },
        async () => {
          successfulCloseCount += 1;
        },
      ],
      {
        gracePeriodMs: 100,
        onError: (error) => errors.push(error),
        setExitCode: (code) => (exitCode = code),
      },
    );

    try {
      await shutdown();
      assert.equal(successfulCloseCount, 1, 'all resources should be closed even if one fails');
      assert.equal(errors.length, 1);
      assert.match(String(errors[0]), /asset close failed/);
      assert.equal(exitCode, 1);
    } finally {
      await closeForTest(serverResult.server);
    }
  });

  it('uses a configurable default shutdown grace period', () => {
    assert.equal(getShutdownGracePeriodMs({}), 10_000);
    assert.equal(getShutdownGracePeriodMs({ SHUTDOWN_GRACE_PERIOD_MS: '2500' }), 2500);
    assert.throws(
      () => getShutdownGracePeriodMs({ SHUTDOWN_GRACE_PERIOD_MS: '-1' }),
      /non-negative integer/,
    );
  });
});
