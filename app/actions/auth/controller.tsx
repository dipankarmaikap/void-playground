import { createController } from 'remix/router';

import { routes } from '../../routes.ts';

export const loginController = createController(routes.auth.login, {
  actions: {
    index() {
      return new Response('OK', { status: 200 });
    },
    action() {
      return new Response('OK', { status: 200 });
    },
  },
});

export const registerController = createController(routes.auth.register, {
  actions: {
    index() {
      return new Response('OK', { status: 200 });
    },
    action() {
      return new Response('OK', { status: 200 });
    },
  },
});

export default createController(routes.auth, {
  actions: {
    verify() {
      return new Response('OK', { status: 200 });
    },
    logout() {
      return new Response('OK', { status: 200 });
    },
  },
});