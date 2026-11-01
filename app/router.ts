import { createRouter, type RouterContext, type Middleware } from 'remix/router';
import { render } from 'remix/middleware/render';
import { staticFiles } from 'remix/middleware/static';
import { session } from 'remix/middleware/session';
import { formData } from 'remix/middleware/form-data';
import { csrf } from 'remix/middleware/csrf';
import { auth, createSessionAuthScheme } from 'remix/middleware/auth';

import { createCookie } from 'remix/cookie';

import controller from './actions/controller.tsx';
import appController from './actions/app/controller.tsx';
import authController from './actions/auth/controller.tsx';
import loginController from './actions/auth/login/controller.tsx';
import registerController from './actions/auth/register/controller.tsx';
import settingsController from './actions/app/settings/controller.tsx';
import { assets } from './assets.ts';
import { routes } from './routes.ts';
import { db, users } from './data/db.ts';
import type { User } from './data/db.ts';
import {
  createHybridSessionStorage,
  sessionRequestContext,
  SESSION_TTL_SECONDS,
} from './data/session-storage.ts';

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET must be set in production');
}

let sessionCookie = createCookie('__session', {
  secrets: [sessionSecret || 'dev-secret-change-me'],
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
});

let sessionStorage = createHybridSessionStorage();

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

const requestContextMiddleware: Middleware = async (context, next) => {
  // Display-only metadata; without a trusted proxy these headers are client-controlled.
  let ip =
    context.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    context.request.headers.get('x-real-ip') ||
    'unknown';
  let userAgent = context.request.headers.get('user-agent') ?? 'unknown';
  return sessionRequestContext.run({ ip, userAgent }, () => next());
};

export const router = createRouter({
  middleware: [
    requestContextMiddleware,
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
router.map(routes.app, appController);
router.map(routes.app.settings, settingsController);
