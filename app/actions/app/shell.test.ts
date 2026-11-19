import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import { APP_NAME } from '../../config.ts';
import { organizations } from '../../data/db.ts';
import { routes } from '../../routes.ts';
import { createTestRouter } from '../../../test/router.ts';
import {
  createUser,
  createUserAndLoginWithOrganization,
  extractCsrf,
  getHtml,
  login,
} from '../../../test/http.ts';

const { router, db } = await createTestRouter();

const authenticatedAreas = [
  ['dashboard', () => routes.app.dashboard.href()],
  ['clients', () => routes.app.clients.index.href()],
  ['invoices', () => routes.app.invoices.index.href()],
  ['settings', () => routes.app.settings.profile.index.href()],
] as const;

function sidebarOf(html: string) {
  let sidebar = html.match(/<aside[\s\S]*?<\/aside>/);
  assert.ok(sidebar, 'the authenticated shell should render a sidebar');
  return sidebar[0];
}

async function signIn(area: string) {
  let { sessionCookie, organizationId } = await createUserAndLoginWithOrganization(
    router,
    db,
    `shell-${area}`,
    'Ada Lovelace',
  );
  let organization = await db.find(organizations, organizationId);
  assert.ok(organization);
  return { sessionCookie, organizationName: organization.name };
}

describe('authenticated shell', () => {
  it('renders the reference sidebar on every authenticated area', async () => {
    for (let [area, href] of authenticatedAreas) {
      let { sessionCookie, organizationName } = await signIn(area);
      let html = await getHtml(router, href(), sessionCookie);
      let sidebar = sidebarOf(html);

      // Brand and the current Organization come from config and request context.
      assert.ok(html.includes(APP_NAME), `${area}: product name should be ${APP_NAME}`);
      assert.ok(sidebar.includes(APP_NAME), `${area}: brand name should be in the sidebar`);
      assert.ok(
        sidebar.includes(organizationName),
        `${area}: the current Organization should be in the sidebar`,
      );
      assert.match(
        sidebar,
        new RegExp(`<span[^>]*aria-hidden="true"[^>]*>${APP_NAME.charAt(0)}<\\/span>`),
        `${area}: brand mark`,
      );

      // Grouped, icon-labelled navigation with only the app's real destinations.
      for (let label of ['Overview', 'Manage', 'Invoicing', 'Workspace']) {
        assert.ok(sidebar.includes(label), `${area}: navigation group ${label}`);
      }
      assert.match(sidebar, /<nav aria-label="Main"/, `${area}: main navigation`);
      assert.match(
        sidebar,
        /<svg[^>]*aria-hidden="true"[^>]*focusable="false"/,
        `${area}: decorative navigation icons`,
      );

      // Plain help copy with no invented Help Center destination.
      assert.match(sidebar, /A little help\?/, `${area}: help card heading`);
      assert.ok(
        sidebar.includes('Manage your Clients, Invoices, and Organization settings from one place.'),
        `${area}: factual help copy`,
      );

      // Signed-in identity and the working Log out form.
      assert.ok(sidebar.includes('Ada Lovelace'), `${area}: identity display name`);
      assert.match(sidebar, /action="\/logout"/, `${area}: Log out destination`);
      assert.match(sidebar, /name="_csrf" value="[^"]+"/, `${area}: Log out CSRF token`);
      assert.match(sidebar, /<form[^>]*method="post"[^>]*action="\/logout"/, `${area}: Log out form`);
      assert.match(sidebar, /Log out/, `${area}: Log out control`);

      // No mock top bar: content starts directly under the shell, identity stays in the sidebar.
      assert.doesNotMatch(html, /aria-label="Breadcrumb"/, `${area}: no breadcrumb top bar`);
      assert.ok(
        sidebar.includes('Ada Lovelace'),
        `${area}: signed-in identity stays in the sidebar`,
      );

      // No decorative mock affordances or invented content.
      assert.doesNotMatch(html, /Search anything/, `${area}: no mock global search`);
      assert.doesNotMatch(html, /⌘ K/, `${area}: no keyboard-shortcut hint`);
      assert.doesNotMatch(html, /Notifications, 2 unread/, `${area}: no notification button`);
      assert.doesNotMatch(html, /notification-dot/, `${area}: no unread dot`);
      assert.doesNotMatch(html, /topbar-avatar/, `${area}: no top bar avatar`);
      assert.doesNotMatch(html, /Free plan/, `${area}: no invented plan label`);
      assert.doesNotMatch(sidebar, />\s*Expenses\s*</, `${area}: no mock Expenses destination`);
      assert.doesNotMatch(sidebar, />\s*Reports\s*</, `${area}: no mock Reports destination`);
      assert.doesNotMatch(sidebar, /New invoice/, `${area}: no mock New invoice shortcut`);
      assert.doesNotMatch(sidebar, /help center/i, `${area}: no invented help destination`);
      assert.doesNotMatch(sidebar, /nav-badge/, `${area}: no hard-coded navigation badge`);
    }
  });

  it('marks the current destination active from the section input', async () => {
    let cases = [
      [routes.app.dashboard.href(), routes.app.dashboard.href()],
      [routes.app.clients.index.href(), routes.app.clients.index.href()],
      [routes.app.invoices.index.href(), routes.app.invoices.index.href()],
      [routes.app.settings.profile.index.href(), routes.app.settings.profile.index.href()],
    ] as const;

    for (let index = 0; index < cases.length; index++) {
      let [path, activeHref] = cases[index];
      let { sessionCookie } = await signIn(`active-${index}`);
      let html = await getHtml(router, path, sessionCookie);

      assert.match(
        html,
        new RegExp(`<a[^>]*href="${activeHref}"[^>]*aria-current="page"`),
        `${path} should be the active destination`,
      );
      let hasSettingsSubnav = path === routes.app.settings.profile.index.href();
      assert.equal(
        /<nav aria-label="Settings"/.test(html),
        hasSettingsSubnav,
        'the Settings subnav appears only on Settings pages',
      );
    }
  });

  it('uses the display name or email in the shell and threads it into the Log out form', async () => {
    let email = `shell-no-name-${crypto.randomUUID()}@example.com`;
    await createUser(db, email, 'password123', true, null);
    let sessionCookie = await login(router, email, 'password123');
    let html = await getHtml(router, routes.app.dashboard.href(), sessionCookie);
    let csrf = extractCsrf(html);

    assert.ok(sidebarOf(html).includes(email), 'the email is the identity when no display name is set');
    assert.match(
      sidebarOf(html),
      new RegExp(`name="_csrf" value="${csrf}"`),
      'the Log out form carries the request CSRF token',
    );
  });

  it('preserves the mobile drawer, skip link, and navigation semantics', async () => {
    let { sessionCookie } = await signIn('a11y');
    let html = await getHtml(router, routes.app.dashboard.href(), sessionCookie);
    let sidebar = sidebarOf(html);

    assert.match(html, /<details/, 'mobile drawer uses a details element');
    assert.match(html, /<summary[\s\S]*?Menu[\s\S]*?<\/summary>/, 'mobile drawer has a summary');
    assert.match(html, /href="#main"/, 'skip link targets main content');
    assert.match(html, /<main id="main"/, 'main content is the skip-link target');
    assert.match(
      html,
      /<\/details>\s*<aside/,
      'the desktop sidebar is outside the collapsed mobile drawer',
    );
    assert.match(
      sidebar,
      new RegExp(`<a[^>]*href="${routes.app.dashboard.href()}"[^>]*data-rmx-document`),
      'sidebar links navigate as full documents so the mobile drawer closes',
    );
  });
});
