import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';
import * as s from 'remix/data-schema';

import { Auth } from 'remix/middleware/auth';
import type { AuthState } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { completeAuth, createCredentialsAuthProvider, verifyCredentials } from 'remix/auth';

import { userPasswords, users } from '../../../data/db.ts';
import type { User } from '../../../data/db.ts';
import { databaseContext } from '../../../middleware/database.ts';
import { setAuthPayload } from '../../../data/session/auth-payload.ts';
import { verifyPassword } from '../../../data/password.ts';
import { getLoginRedirectURL, getPostAuthRedirect } from '../../../middleware/auth.ts';
import { routes } from '../../../routes.ts';
import { LoginPage } from './page.tsx';
import { LoginForm } from './public/schema.ts';

const credentialsProvider = createCredentialsAuthProvider<
  { email: string; password: string },
  User
>({
  parse(context) {
    let parsed = s.parseSafe(LoginForm, context.get(FormData)!);
    let { email, password } = parsed.success
      ? parsed.value
      : { email: '', password: '' };
    return {
      email: email.trim().toLowerCase(),
      password,
    };
  },
  async verify({ email, password }, context) {
    let db = context.get(databaseContext);
    if (db == null) {
      throw new Error('Expected loadDatabase() middleware before auth()');
    }
    let user = await db.findOne(users, { where: { email } });
    if (!user || !user.email_verified) return null;
    let creds = await db.findOne(userPasswords, { where: { user_id: user.id } });
    if (!creds) return null;
    let ok = await verifyPassword(password, creds.password_hash);
    if (!ok) return null;
    return user;
  },
});

export default createController(routes.auth.login, {
  actions: {
    async index(context) {
      let auth = context.get(Auth) as AuthState<User>;
      if (auth?.ok) {
        return redirect(getPostAuthRedirect(context.url));
      }
      let csrfToken = getCsrfToken(context);
      let error = context.session.get('error');
      let message = context.session.get('message');
      return context.render(
        <LoginPage
          csrfToken={csrfToken}
          action={getLoginRedirectURL(context.url)}
          error={typeof error === 'string' ? error : undefined}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
    async action(context) {
      let user = await verifyCredentials(credentialsProvider, context);
      if (!user) {
        context.session.flash('error', 'Invalid email or password');
        return redirect(getLoginRedirectURL(context.url));
      }
      let session = completeAuth(context);
      setAuthPayload(session, { userId: user.id });
      return redirect(getPostAuthRedirect(context.url));
    },
  },
});
