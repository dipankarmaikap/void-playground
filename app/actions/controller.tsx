import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { requireAuth } from 'remix/middleware/auth';
import { Auth } from 'remix/middleware/auth';
import type { GoodAuth } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { assets } from '../assets.ts';
import { db, users } from '../data/db.ts';
import type { User } from '../data/db.ts';
import { routes } from '../routes.ts';
import { HomePage } from './home-page.tsx';
import { DashboardPage } from './auth/pages.tsx';

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response('Not Found', { status: 404 });
    },
    home(context) {
      return context.render(<HomePage />);
    },
    dashboard: {
      middleware: [requireAuth<User>({ onFailure: () => redirect('/login') })],
      async handler(context) {
        let auth = context.get(Auth) as GoodAuth<User>;
        let user = await db.find(users, auth.identity.id);
        let csrfToken = getCsrfToken(context);
        return context.render(<DashboardPage csrfToken={csrfToken} email={user?.email} />);
      },
    },
  },
});
