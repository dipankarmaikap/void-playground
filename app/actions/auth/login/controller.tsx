import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import { Auth } from 'remix/middleware/auth';
import type { AuthState } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { completeAuth, createCredentialsAuthProvider, verifyCredentials } from 'remix/auth';

import { db, users, userPasswords } from '../../../data/db.ts';
import type { User } from '../../../data/db.ts';
import { verifyPassword } from '../../../data/password.ts';
import { routes } from '../../../routes.ts';
import { LoginPage } from './page.tsx';

const credentialsProvider = createCredentialsAuthProvider<
  { email: string; password: string },
  User
>({
  parse(context) {
    let formData = context.get(FormData)!;
    return {
      email: String(formData.get('email') ?? '')
        .trim()
        .toLowerCase(),
      password: String(formData.get('password') ?? ''),
    };
  },
  async verify({ email, password }) {
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
        return redirect(routes.app.dashboard.href());
      }
      let csrfToken = getCsrfToken(context);
      let error = context.session.get('error');
      let message = context.session.get('message');
      return context.render(
        <LoginPage
          csrfToken={csrfToken}
          error={typeof error === 'string' ? error : undefined}
          message={typeof message === 'string' ? message : undefined}
        />,
      );
    },
    async action(context) {
      let user = await verifyCredentials(credentialsProvider, context);
      if (!user) {
        context.session.flash('error', 'Invalid email or password');
        return redirect(routes.auth.login.index.href());
      }
      let session = completeAuth(context);
      session.set('auth', { userId: user.id });
      return redirect(routes.app.dashboard.href());
    },
  },
});
