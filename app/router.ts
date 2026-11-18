import { createRouter, type Middleware, type RouterContext } from 'remix/router';
import { asyncContext } from 'remix/middleware/async-context';
import { csp } from 'remix/middleware/csp';
import { render } from 'remix/middleware/render';
import { staticFiles } from 'remix/middleware/static';
import { session } from 'remix/middleware/session';
import { formData } from 'remix/middleware/form-data';
import { csrf } from 'remix/middleware/csrf';
import { Auth, auth } from 'remix/middleware/auth';

import controller from './actions/controller.tsx';
import appController from './actions/app/controller.tsx';
import clientsController from './actions/app/clients/controller.tsx';
import newClientController from './actions/app/clients/new/controller.tsx';
import editClientController from './actions/app/clients/edit/controller.tsx';
import clientLifecycleController from './actions/app/clients/lifecycle/controller.tsx';
import invoicesController from './actions/app/invoices/controller.tsx';
import newInvoiceController from './actions/app/invoices/new/controller.tsx';
import editInvoiceController from './actions/app/invoices/edit/controller.tsx';
import invoiceLifecycleController from './actions/app/invoices/lifecycle/controller.tsx';
import invoicePaymentsController from './actions/app/invoices/payments/controller.tsx';
import invoiceRefundsController from './actions/app/invoices/refunds/controller.tsx';
import newCreditNoteController from './actions/app/invoices/credit-notes/new/controller.tsx';
import editCreditNoteController from './actions/app/invoices/credit-notes/edit/controller.tsx';
import creditNoteLifecycleController from './actions/app/invoices/credit-notes/lifecycle/controller.tsx';
import creditNotesController from './actions/app/invoices/credit-notes/controller.tsx';
import authController from './actions/auth/controller.tsx';
import loginController from './actions/auth/login/controller.tsx';
import registerController from './actions/auth/register/controller.tsx';
import verifyController from './actions/auth/verify/controller.tsx';
import settingsProfileController from './actions/app/settings/profile/controller.tsx';
import settingsInvoicingController from './actions/app/settings/invoicing/controller.tsx';
import settingsSessionsController from './actions/app/settings/sessions/controller.tsx';
import { assets, documentScriptEntryMiddleware } from './assets.ts';
import { requestContextMiddleware } from './middleware/request-context.ts';
import { routes } from './routes.ts';
import { sessionCookie, sessionStorage, sessionScheme } from './data/session/setup.ts';

const isDevelopment = process.env.NODE_ENV === 'development';

const privateAppHtml: Middleware = async (context, next) => {
  let response = await next();
  let path = context.url.pathname;
  let auth = context.get(Auth) as { ok?: boolean } | undefined;

  if (
    !auth?.ok ||
    (path !== '/app' && !path.startsWith('/app/')) ||
    !response.headers.get('Content-Type')?.toLowerCase().includes('text/html')
  ) {
    return response;
  }

  let headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const sourceAssets: Middleware = async (context, next) => {
  if (context.url.pathname !== '/assets' && !context.url.pathname.startsWith('/assets/')) {
    return next();
  }
  return (await assets.fetch(context.request)) ?? new Response('Not Found', { status: 404 });
};

const homeMethodGuard: Middleware = async (context, next) => {
  if (
    context.url.pathname === '/' &&
    context.method !== 'GET' &&
    context.method !== 'HEAD'
  ) {
    return new Response(`Method Not Allowed: ${context.method}`, {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }
  return next();
};

export const router = createRouter({
  middleware: [
    requestContextMiddleware,
    asyncContext(),
    staticFiles('./public', { index: false }),
    sourceAssets,
    homeMethodGuard,
    session(sessionCookie, sessionStorage),
    formData(),
    csrf(),
    auth({ schemes: [sessionScheme] }),
    privateAppHtml,
    documentScriptEntryMiddleware,
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
router.map(routes.auth.verify, verifyController);
router.map(routes.auth, authController);
router.map(routes.app, appController);
router.map(routes.app.clients, clientsController);
router.map(routes.app.clients.new, newClientController);
router.map(routes.app.clients.edit, editClientController);
router.map(routes.app.clients.lifecycle, clientLifecycleController);
router.map(routes.app.invoices, invoicesController);
router.map(routes.app.invoices.new, newInvoiceController);
router.map(routes.app.invoices.edit, editInvoiceController);
router.map(routes.app.invoices.lifecycle, invoiceLifecycleController);
router.map(routes.app.invoices.payments, invoicePaymentsController);
router.map(routes.app.invoices.refunds, invoiceRefundsController);
router.map(routes.app.invoices.creditNotes.new, newCreditNoteController);
router.map(routes.app.invoices.creditNotes.edit, editCreditNoteController);
router.map(routes.app.invoices.creditNotes.lifecycle, creditNoteLifecycleController);
router.map(routes.app.invoices.creditNotes, creditNotesController);
router.map(routes.app.settings.profile, settingsProfileController);
router.map(routes.app.settings.invoicing, settingsInvoicingController);
router.map(routes.app.settings.sessions, settingsSessionsController);
