import { createAssetServer } from 'remix/assets';
import type { ScriptEntry } from 'remix/assets';
import { loadConfig } from 'remix/cli';
import { componentHmr } from 'remix/component-hmr/assets';
import { createContextKey, type Middleware } from 'remix/router';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isDevelopment = nodeEnv === 'development';
const isProduction = nodeEnv === 'production';
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR);

// The JSON-compatible asset mapping (root directory, allow and deny lists) lives in remix.json;
// only environment-dependent behavior stays in code.
const config = await loadConfig(import.meta.dirname);
if (config.assets === undefined) {
  throw new Error('Missing assets configuration in remix.json');
}

export const assets = createAssetServer({
  ...config.assets,
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
