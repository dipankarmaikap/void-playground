import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { db, users } from '../../data/db.ts';
import { routes } from '../../routes.ts';

export default createController(routes.auth, {
  actions: {
    async verify(context) {
      let token = context.url.searchParams.get('token');
      if (!token) {
        context.session.flash('error', 'Invalid or expired verification link');
        return redirect(routes.auth.login.index.href());
      }

      let user = await db.findOne(users, { where: { verification_token: token } });
      if (
        !user ||
        user.verification_expires_at == null ||
        user.verification_expires_at <= Date.now()
      ) {
        context.session.flash('error', 'Invalid or expired verification link');
        return redirect(routes.auth.login.index.href());
      }

      await db.update(users, user.id, {
        email_verified: true,
        verification_token: null,
        verification_expires_at: null,
      });

      context.session.flash('message', 'Email verified. You can now log in.');
      return redirect(routes.auth.login.index.href());
    },
    logout(context) {
      context.session.destroy();
      return redirect(routes.home.href());
    },
  },
});
