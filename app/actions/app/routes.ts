import { form, get, route } from 'remix/routes';

import { clientRoutes } from './clients/routes.ts';

export const appRoutes = route({
  dashboard: get('/dashboard'),
  clients: route('/clients', clientRoutes),
  settings: route('/settings', {
    profile: form('/'),
    invoicing: form('/invoicing'),
    sessions: form('/sessions'),
  }),
});
