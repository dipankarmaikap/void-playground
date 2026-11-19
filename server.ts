import { createServer } from 'node:http';
import { createRequestListener } from 'remix/node-fetch-server';

import { assets } from './app/assets.ts';
import { createAppRouter } from './app/router.ts';
import { createAppDatabase } from './app/data/db.ts';
import { migrateDatabase } from './app/data/db/migrate.ts';
import {
  getNodeRequestListenerOptions,
  getShutdownGracePeriodMs,
} from './app/server-config.ts';
import { createShutdownHandler } from './app/server-shutdown.ts';

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100;
const hmrProxyPort = process.env.HMR_PROXY_PORT
  ? Number.parseInt(process.env.HMR_PROXY_PORT, 10)
  : null;
const isHmr = process.env.REMIX_NODE_HMR === '1';

// The application database is constructed here and injected into the router; request handling
// never imports a database instance. Migrations are applied before the HTTP server starts
// listening, so no request ever sees a half-migrated schema. A legacy database fails closed
// here with the operator clean-start message instead of reaching the runner.
const db = createAppDatabase();
await migrateDatabase(db);
const router = createAppRouter({ db });

const server = createServer(createRequestListener(router.fetch, getNodeRequestListenerOptions()));

server.listen(port, () => {
  if (isHmr) {
    import('remix/node-hmr/runtime').then((nodeHmr) => nodeHmr.emitServerReady());
  }

  console.log(`Server listening on http://localhost:${hmrProxyPort ?? port}`);
});

const shutdown = createShutdownHandler(
  server,
  [() => assets.close(), () => db.close()],
  {
    gracePeriodMs: getShutdownGracePeriodMs(),
    onError(error) {
      console.error('Server shutdown failed', error);
    },
    setExitCode(code) {
      process.exitCode = code;
    },
  },
);

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
