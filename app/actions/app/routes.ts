import { form, get, route } from 'remix/routes';

import { clientRoutes } from './clients/routes.ts';
import { invoiceRoutes } from './invoices/routes.ts';

export const appRoutes = route({
  dashboard: get('/dashboard'),
  clients: route('/clients', clientRoutes),
  invoices: route('/invoices', invoiceRoutes),
  settings: route('/settings', {
    profile: form('/'),
    invoicing: form('/invoicing'),
    sessions: form('/sessions'),
  }),
});
