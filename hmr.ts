import * as http from 'node:http';

import { createFetchProxy } from 'remix/fetch-proxy';
import { createHmrReadyFetch, run } from 'remix/node-hmr';
import { createRequestListener } from 'remix/node-fetch-server';

import { getShutdownGracePeriodMs } from './app/server-config.ts';
import { createShutdownHandler } from './app/server-shutdown.ts';

const hmrProxyPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100;
const hmrEventPort = process.env.HMR_PORT
  ? Number.parseInt(process.env.HMR_PORT, 10)
  : hmrProxyPort + 1;
const appPort = process.env.APP_PORT ? Number.parseInt(process.env.APP_PORT, 10) : hmrEventPort + 1;

const hmrRunner = run('server.ts', {
  env: {
    ...process.env,
    PORT: String(appPort),
    HMR_PROXY_PORT: String(hmrProxyPort),
  },
  nodeArgs: ['--import', 'remix/node-tsx', '--import', 'remix/component-hmr/node'],
  browserHmrChannel: { port: hmrEventPort },
});

const server = http.createServer(
  createRequestListener(
    createHmrReadyFetch(
      hmrRunner,
      createFetchProxy(`http://127.0.0.1:${appPort}`, {
        xForwardedHeaders: true,
      }),
    ),
  ),
);

server.listen(hmrProxyPort, '127.0.0.1');

const shutdown = createShutdownHandler(server, [() => hmrRunner.close()], {
  gracePeriodMs: getShutdownGracePeriodMs(),
  onError(error) {
    console.error('HMR proxy shutdown failed', error);
  },
  setExitCode(code) {
    process.exitCode = code;
  },
});

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
