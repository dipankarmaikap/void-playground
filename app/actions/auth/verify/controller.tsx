import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';
import * as s from 'remix/data-schema';
import type { SqliteDatabase } from 'remix/data-table/sqlite';

import { getCsrfToken } from 'remix/middleware/csrf';

import { users } from '../../../data/db.ts';
import { routes } from '../../../routes.ts';
import { VerifyEmailPage } from './page.tsx';
import { VerifyForm } from './public/schema.ts';

export default createController(routes.auth.verify, {
  actions: {
    async index(context) {
      let token = context.url.searchParams.get('token');
      let user = await findValidVerificationUser(context.db, token);

      if (!user || token == null) {
        context.session.flash('error', 'Invalid or expired verification link');
        return redirect(routes.auth.login.index.href());
      }

      return context.render(
        <VerifyEmailPage csrfToken={getCsrfToken(context)} token={token} />,
      );
    },
    async action(context) {
      let parsed = s.parseSafe(VerifyForm, context.formData);
      let token = parsed.success ? parsed.value.token : '';
      let user = await findValidVerificationUser(context.db, token);

      if (!user) {
        context.session.flash('error', 'Invalid or expired verification link');
        return redirect(routes.auth.login.index.href());
      }

      await context.db.update(users, user.id, {
        email_verified: true,
        verification_token: null,
        verification_expires_at: null,
      });

      context.session.flash('message', 'Email verified. You can now log in.');
      return redirect(routes.auth.login.index.href());
    },
  },
});

async function findValidVerificationUser(db: SqliteDatabase, token: string | null) {
  if (!token) return null;
  let user = await db.findOne(users, { where: { verification_token: token } });
  if (!user || !isTokenValid(user.verification_expires_at)) return null;
  return user;
}

function isTokenValid(expiresAt: number | null): boolean {
  return expiresAt != null && expiresAt > Date.now();
}
