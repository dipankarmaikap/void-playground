import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { routes } from '../../routes.ts';

export default createController(routes.auth, {
  actions: {
    logout(context) {
      context.session.destroy();
      return redirect(routes.home.href());
    },
  },
});
