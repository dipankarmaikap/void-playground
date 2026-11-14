import { createAssetServer } from 'remix/assets';
import type { ScriptEntry } from 'remix/assets';
import { componentHmr } from 'remix/component-hmr/assets';
import { createContextKey, type Middleware } from 'remix/router';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isDevelopment = nodeEnv === 'development';
const isProduction = nodeEnv === 'production';
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR);

export const assets = createAssetServer({
  basePath: '/assets',
  rootDir: process.cwd(),

  allowFiles: [
    'app/routes.ts',
    'app/actions/app/routes.ts',
    'app/actions/app/clients/routes.ts',
    'app/**/public/**',
  ],
  allowPackages: ['remix'],
  denyFiles: ['app/**/*.test.*'],
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  fingerprint: isProduction,
  watch: isDevelopment,
  hmr: isHmr
    ? {
        channel: async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel(),
        moduleImporter: 'remix/multiple-import-maps-polyfill',
      }
    : undefined,
  scripts: { loaders: isHmr ? [componentHmr()] : undefined },
});

const entry = 'app/actions/public/entry.ts';

export const documentScriptEntry = createContextKey<ScriptEntry>(await assets.getScriptEntry(entry));

/** Refreshes document import-map and preload metadata from the watched asset graph. */
export const documentScriptEntryMiddleware: Middleware = async (context, next) => {
  context.set(documentScriptEntry, await assets.getScriptEntry(entry));
  return next();
};
