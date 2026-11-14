import { form, get, post, route } from 'remix/routes';

import { appRoutes } from './actions/app/routes.ts';

export const routes = route({
  assets: get('/assets/*path'),
  home: get('/'),
  auth: {
    login: form('/login'),
    register: form('/register'),
    verify: form('/verify'),
    logout: post('/logout'),
  },
  app: route('/app', appRoutes),
});
