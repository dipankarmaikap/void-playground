import { createRouter, type RouterContext } from 'remix/router';
import { render } from 'remix/middleware/render';
import { staticFiles } from 'remix/middleware/static';
import { session } from 'remix/middleware/session';
import { formData } from 'remix/middleware/form-data';
import { csrf } from 'remix/middleware/csrf';
import { auth } from 'remix/middleware/auth';

import controller from './actions/controller.tsx';
import appController from './actions/app/controller.tsx';
import authController from './actions/auth/controller.tsx';
import loginController from './actions/auth/login/controller.tsx';
import registerController from './actions/auth/register/controller.tsx';
import settingsController from './actions/app/settings/controller.tsx';
import { assets } from './assets.ts';
import { requestContextMiddleware } from './middleware/request-context.ts';
import { routes } from './routes.ts';
import { sessionCookie, sessionStorage, sessionScheme } from './data/session.ts';

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
