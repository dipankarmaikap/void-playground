import { createController } from 'remix/router';

import { Auth } from 'remix/middleware/auth';
import type { AuthState } from 'remix/middleware/auth';

import { assets } from '../assets.ts';
import type { User } from '../data/db.ts';
import { routes } from '../routes.ts';
import { HomePage } from './home-page.tsx';

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response('Not Found', { status: 404 });
    },
    home(context) {
      let auth = context.get(Auth) as AuthState<User>;
      return context.render(<HomePage authenticated={Boolean(auth?.ok)} />);
    },
  },
});
