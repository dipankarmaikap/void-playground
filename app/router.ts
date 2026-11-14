import { createRouter, type RouterContext } from 'remix/router';
import { asyncContext } from 'remix/middleware/async-context';
import { csp } from 'remix/middleware/csp';
import { render } from 'remix/middleware/render';
import { staticFiles } from 'remix/middleware/static';
import { session } from 'remix/middleware/session';
import { formData } from 'remix/middleware/form-data';
import { csrf } from 'remix/middleware/csrf';
import { auth } from 'remix/middleware/auth';

import controller from './actions/controller.tsx';
import appController from './actions/app/controller.tsx';
import clientsController from './actions/app/clients/controller.tsx';
import newClientController from './actions/app/clients/new/controller.tsx';
import editClientController from './actions/app/clients/edit/controller.tsx';
import clientLifecycleController from './actions/app/clients/lifecycle/controller.tsx';
import authController from './actions/auth/controller.tsx';
import loginController from './actions/auth/login/controller.tsx';
import registerController from './actions/auth/register/controller.tsx';
import settingsProfileController from './actions/app/settings/profile/controller.tsx';
import settingsSessionsController from './actions/app/settings/sessions/controller.tsx';
import { assets } from './assets.ts';
import { requestContextMiddleware } from './middleware/request-context.ts';
import { routes } from './routes.ts';
import { sessionCookie, sessionStorage, sessionScheme } from './data/session.ts';

const isDevelopment = process.env.NODE_ENV === 'development';

export const router = createRouter({
  middleware: [
    requestContextMiddleware,
    asyncContext(),
    staticFiles('./public', { index: false }),
    session(sessionCookie, sessionStorage),
    formData(),
    csrf(),
    auth({ schemes: [sessionScheme] }),
    csp({
      policy({ nonce }) {
        return {
          defaultSrc: ["'self'"],
          scriptSrc: [`'nonce-${nonce}'`],
          styleSrc: [`'nonce-${nonce}'`],
          imgSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          ...(isDevelopment
            ? { connectSrc: ["'self'", 'http://localhost:*', 'http://127.0.0.1:*'] }
            : {}),
        };
      },
    }),
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
router.map(routes.app.clients, clientsController);
router.map(routes.app.clients.new, newClientController);
router.map(routes.app.clients.edit, editClientController);
router.map(routes.app.clients.lifecycle, clientLifecycleController);
router.map(routes.app.settings.profile, settingsProfileController);
router.map(routes.app.settings.sessions, settingsSessionsController);
