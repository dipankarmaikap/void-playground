import { createRouter, type RouterContext } from 'remix/router';
import { render } from 'remix/middleware/render';
import { staticFiles } from 'remix/middleware/static';
import { session } from 'remix/middleware/session';
import { formData } from 'remix/middleware/form-data';
import { csrf } from 'remix/middleware/csrf';
import { auth, createSessionAuthScheme } from 'remix/middleware/auth';

import { createCookie } from 'remix/cookie';
import { createCookieSessionStorage } from 'remix/session-storage/cookie';

import controller from './actions/controller.tsx';
import authController, { loginController, registerController } from './actions/auth/controller.tsx';
import { assets } from './assets.ts';
import { routes } from './routes.ts';
import { db, users } from './data/db.ts';
import type { User } from './data/db.ts';

let sessionCookie = createCookie('__session', {
  secrets: [process.env.SESSION_SECRET ?? 'dev-secret-change-me'],
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
});

let sessionStorage = createCookieSessionStorage();

let sessionScheme = createSessionAuthScheme<User, { userId: string }>({
  read(session) {
    return session.get('auth') as { userId: string } | null;
  },
  async verify(value) {
    return (await db.find(users, value.userId)) ?? null;
  },
  invalidate(session) {
    session.unset('auth');
  },
});

export const router = createRouter({
  middleware: [
    staticFiles('./public', { index: false }),
    session(sessionCookie, sessionStorage),
    formData(),
    csrf(),
    auth({ schemes: [sessionScheme] }),
    render({ assets }),
  ],
});

export type AppContext = RouterContext<typeof router>;

declare module 'remix' {
  interface RouterTypes {
    context: AppContext;
  }
}

router.map(routes, controller);
router.map(routes.auth.login, loginController);
router.map(routes.auth.register, registerController);
router.map(routes.auth, authController);
