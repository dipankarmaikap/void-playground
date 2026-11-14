import { form, get, route } from 'remix/routes';

export const appRoutes = route({
  dashboard: get('/dashboard'),
  settings: route('/settings', {
    profile: form('/'),
    sessions: form('/sessions'),
  }),
});
