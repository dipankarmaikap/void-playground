import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { requireAuth } from 'remix/middleware/auth';
import { Auth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { and, ne } from 'remix/data-table';
import { db, sessions } from '../../../../data/db.ts';
import type { User } from '../../../../data/db.ts';
import { browserLabel } from '../../../../data/user-agent.ts';
import { routes } from '../../../../routes.ts';
import { SessionsPage } from './page.tsx';
import type { SessionView } from './page.tsx';

export default createController(routes.app.settings.sessions, {
  middleware: [requireAuth<User>({ onFailure: () => redirect(routes.auth.login.index.href()) })],
  actions: {
    async index(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let identity = auth.identity;
      let csrfToken = getCsrfToken(context);
      let rows = await db.findMany(sessions, {
        where: { user_id: auth.identity.id },
        orderBy: [['created_at', 'desc']],
      });
      let currentId = context.session.id;
      let views: SessionView[] = rows.map((row) => ({
        id: row.id,
        current: row.id === currentId,
        browser: browserLabel(row.user_agent),
        ip: row.ip ?? 'unknown',
        createdAt: new Date(row.created_at).toLocaleString(),
        lastActiveAt: new Date(row.last_active_at).toLocaleString(),
      }));
      // Stable sort keeps newest-first order within each group.
      views.sort((a, b) => Number(b.current) - Number(a.current));
      let error = context.session.get('error');
      let message = context.session.get('message');
      return context.render(
        <SessionsPage
          csrfToken={csrfToken}
          identity={{ email: identity.email, displayName: identity.display_name }}
          sessions={views}
          error={typeof error === 'string' ? error : undefined}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
    async action(context) {
      let auth = context.get(Auth) as GoodAuth<User>;
      let action = String(context.formData.get('action') ?? '');
      let currentId = context.session.id;

      if (action === 'revoke') {
        let sessionId = String(context.formData.get('session_id') ?? '');
        let row = await db.find(sessions, sessionId);
        if (!row || row.user_id !== auth.identity.id) {
          context.session.flash('error', 'Session not found');
          return redirect(routes.app.settings.sessions.index.href());
        }
        await db.delete(sessions, sessionId);
        if (sessionId === currentId) {
          context.session.destroy();
          return redirect(routes.auth.login.index.href());
        }
        context.session.flash('message', 'Session revoked');
        return redirect(routes.app.settings.sessions.index.href());
      }

      if (action === 'revoke_others') {
        await db.deleteMany(sessions, {
          where: and({ user_id: auth.identity.id }, ne('id', currentId)),
        });
        context.session.flash('message', 'Revoked all other sessions');
        return redirect(routes.app.settings.sessions.index.href());
      }

      return redirect(routes.app.settings.sessions.index.href());
    },
  },
});
