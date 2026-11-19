import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { assets } from '../app/assets.ts';
import { router } from '../app/router.ts';
import { routes } from '../app/routes.ts';
import { createUserAndLogin, extractCsrf, origin } from './http.ts';

describe('browser asset graph', () => {
  it('allows only the shared route contract and its browser-safe route modules', async () => {
    for (let path of [
      'app/routes.ts',
      'app/actions/app/routes.ts',
      'app/actions/app/clients/routes.ts',
    ]) {
      let details = await assets.getAssetDetails(path);
      assert.equal(details.status, 'reachable', `${path} should be browser-reachable`);
    }

    let routeEntry = await assets.getScriptEntry('app/routes.ts');
    assert.ok(
      routeEntry.preloads.some((href) => href.includes('/app/actions/app/routes.ts')),
      'the browser import graph should include the app route map',
    );
    assert.ok(
      routeEntry.preloads.some((href) => href.includes('/app/actions/app/clients/routes.ts')),
      'the browser import graph should include nested Client route definitions',
    );

    let browserEntry = await assets.getScriptEntry('app/actions/public/entry.ts');
    assert.ok(
      browserEntry.preloads.some((href) => href.includes('/assets/app/routes.ts')),
      'the browser runtime should be able to import the shared route contract',
    );

    for (let path of [
      'app/actions/app/clients/controller.tsx',
      'app/data/clients.ts',
      'app/actions/app/clients/controller.test.ts',
    ]) {
      let details = await assets.getAssetDetails(path);
      assert.notEqual(details.status, 'reachable', `${path} must remain outside the asset graph`);
    }
  });

  it('ships every shared form schema through the per-feature public convention', async () => {
    // The `app/**/public/**` allow-list entry is the structural browser-bundle boundary: each
    // form's schema module must stay under it so the browser can use the same description the
    // server parses with.
    for (let path of [
      'app/ui/public/form-field.ts',
      'app/actions/auth/login/public/schema.ts',
      'app/actions/auth/register/public/schema.ts',
      'app/actions/auth/verify/public/schema.ts',
      'app/actions/app/clients/public/schema.ts',
      'app/actions/app/invoices/public/schema.ts',
      'app/actions/app/invoices/payments/public/schema.ts',
      'app/actions/app/invoices/refunds/public/schema.ts',
      'app/actions/app/invoices/credit-notes/public/schema.ts',
      'app/actions/app/settings/profile/public/schema.ts',
      'app/actions/app/settings/invoicing/public/schema.ts',
    ]) {
      let details = await assets.getAssetDetails(path);
      assert.equal(details.status, 'reachable', `${path} should be browser-reachable`);
    }

    // The server-only pieces those schemas describe stay outside the graph.
    for (let path of [
      'app/actions/app/clients/parse-client-form.ts',
      'app/actions/app/settings/invoicing/form-values.ts',
      'app/data/organization/invoicing.ts',
    ]) {
      let details = await assets.getAssetDetails(path);
      assert.notEqual(details.status, 'reachable', `${path} must remain outside the asset graph`);
    }
  });

  it('renders current import-map, preload, and entry metadata on each document response', async () => {
    let originalGetScriptEntry = assets.getScriptEntry;
    let version = 1;
    let sessionCookie = await createUserAndLogin(router, 'asset-refresh');

    assets.getScriptEntry = async function (path) {
      let entry = await originalGetScriptEntry.call(assets, path);
      return {
        href: `/assets/entry-v${version}.ts`,
        preloads: [...entry.preloads, `/assets/preload-v${version}.js`],
        importMap: {
          ...entry.importMap,
          imports: {
            ...entry.importMap.imports,
            [`route-contract-v${version}`]: `/assets/module-v${version}.js`,
          },
        },
      };
    };

    try {
      for (let currentVersion of [1, 2]) {
        version = currentVersion;
        let response = await router.fetch('http://localhost/');
        let html = await response.text();

        assert.equal(response.status, 200);
        assert.match(html, new RegExp(`src="/assets/entry-v${currentVersion}\\.ts"`));
        assert.match(html, new RegExp(`href="/assets/preload-v${currentVersion}\\.js"`));
        assert.ok(
          html.includes(
            `"route-contract-v${currentVersion}":"/assets/module-v${currentVersion}.js"`,
          ),
        );
      }

      let formPage = await router.fetch(
        new URL(routes.app.clients.new.index.href(), origin),
        { headers: { Cookie: sessionCookie } },
      );
      let csrf = extractCsrf(await formPage.text());

      version = 3;
      let validation = await router.fetch(
        new URL(routes.app.clients.new.action.href(), origin),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: sessionCookie,
          },
          body: new URLSearchParams({
            type: 'individual',
            legal_name: '',
            _csrf: csrf,
          }).toString(),
        },
      );
      let validationHtml = await validation.text();

      assert.equal(validation.status, 400);
      assert.match(validationHtml, /src="\/assets\/entry-v3\.ts"/);
      assert.match(validationHtml, /href="\/assets\/preload-v3\.js"/);
      assert.ok(
        validationHtml.includes('"route-contract-v3":"/assets/module-v3.js"'),
      );
    } finally {
      assets.getScriptEntry = originalGetScriptEntry;
    }
  });
});
