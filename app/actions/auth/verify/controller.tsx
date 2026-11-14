import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { getCsrfToken } from 'remix/middleware/csrf';

import { db, users } from '../../../data/db.ts';
import { routes } from '../../../routes.ts';
import { VerifyEmailPage } from './page.tsx';

export default createController(routes.auth.verify, {
  actions: {
    async index(context) {
      let token = context.url.searchParams.get('token');
      let user = token
        ? await db.findOne(users, { where: { verification_token: token } })
        : null;

      if (!user || !isTokenValid(user.verification_expires_at)) {
        context.session.flash('error', 'Invalid or expired verification link');
        return redirect(routes.auth.login.index.href());
      }

      return context.render(
        <VerifyEmailPage csrfToken={getCsrfToken(context)} token={token!} />,
      );
    },
    async action(context) {
      let tokenValue = context.formData.get('token');
      let token = typeof tokenValue === 'string' ? tokenValue : '';
      let user = token
        ? await db.findOne(users, { where: { verification_token: token } })
        : null;

      if (!user || !isTokenValid(user.verification_expires_at)) {
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
  },
});

function isTokenValid(expiresAt: number | null): boolean {
  return expiresAt != null && expiresAt > Date.now();
}
