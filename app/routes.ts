import { form, get, post, route } from 'remix/routes';

import { appRoutes } from './actions/app/routes.ts';

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  auth: {
    login: form('/login'),
    register: form('/register'),
    verify: get('/verify'),
    logout: post('/logout'),
  },
  app: route('/app', appRoutes),
});
