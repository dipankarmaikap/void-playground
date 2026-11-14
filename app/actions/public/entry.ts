import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill';
import { run } from 'remix/component';

import { routes } from '../../routes.ts';
import { createRuntimeErrorHandler, reportBrowserRuntimeError } from './runtime-errors.ts';

const app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await importModule(moduleUrl);
    let Component = mod[exportName];
    if (typeof Component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`);
    }
    return Component;
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads;

    preloadShim(preloads);
    return [];
  },
});

let handleRuntimeError = createRuntimeErrorHandler({
  report: reportBrowserRuntimeError,
  showRecovery(recover) {
    let notice = document.createElement('div');
    notice.setAttribute('role', 'alert');

    let message = document.createElement('p');
    message.textContent = 'Something went wrong. Reload the page to continue.';

    let button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Reload page';
    button.addEventListener('click', recover, { once: true });

    let homeLink = document.createElement('a');
    homeLink.href = routes.home.href();
    homeLink.textContent = 'Go to home page';

    notice.append(message, button, homeLink);
    document.body.prepend(notice);
  },
  recover() {
    window.location.reload();
  },
});

app.addEventListener('error', handleRuntimeError);
void app.ready().catch(() => {
  // run() reports the hydration failure through the error event listener above.
});

let hot = (import.meta as { hot?: { on: (event: string, cb: () => void | Promise<void>) => void } }).hot;
if (hot) {
  hot.on('server:update', async () => {
    try {
      await app.ready();
      await app.frames.top.reload();
    } catch (error) {
      console.error('Error reloading top frame on server update', error);
    }
  });
}
