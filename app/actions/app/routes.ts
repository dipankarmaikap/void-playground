import { form, get, route } from 'remix/routes';

export const appRoutes = route({
  dashboard: get('/dashboard'),
  settings: form('/settings'),
});