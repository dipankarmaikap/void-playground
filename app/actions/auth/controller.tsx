import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import * as s from 'remix/data-schema';
import * as f from 'remix/data-schema/form-data';
import * as checks from 'remix/data-schema/checks';

import { getCsrfToken } from 'remix/middleware/csrf';

import { completeAuth, createCredentialsAuthProvider, verifyCredentials } from 'remix/auth';

import { db, users, userPasswords } from '../../data/db.ts';
import type { User } from '../../data/db.ts';
import { routes } from '../../routes.ts';
import { LoginPage, RegisterPage } from './pages.tsx';

const credentialsProvider = createCredentialsAuthProvider<{ email: string; password: string }, User>({
  parse(context) {
    let formData = context.get(FormData)!;
    return {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    };
  },
  async verify({ email, password }) {
    let user = await db.findOne(users, { where: { email } });
    if (!user || !user.email_verified) return null;
    let creds = await db.findOne(userPasswords, { where: { user_id: user.id } });
    if (!creds) return null;
    let ok = await Bun.password.verify(password, creds.password_hash);
    if (!ok) return null;
    return user;
  },
});

const registerForm = f.object({
  email: f.field(s.string().pipe(checks.email())),
  password: f.field(s.string().pipe(checks.minLength(8))),
});

export const loginController = createController(routes.auth.login, {
  actions: {
    async index(context) {
      let csrfToken = getCsrfToken(context);
      let error = context.session.get('error');
      return context.render(
        <LoginPage
          csrfToken={csrfToken}
          error={typeof error === 'string' ? error : undefined}
        />,
      );
    },
    async action(context) {
      let user = await verifyCredentials(credentialsProvider, context);
      if (!user) {
        context.session.flash('error', 'Invalid email or password');
        return redirect('/login');
      }
      let session = completeAuth(context);
      session.set('auth', { userId: user.id });
      return redirect('/dashboard');
    },
  },
});

export const registerController = createController(routes.auth.register, {
  actions: {
    async index(context) {
      let csrfToken = getCsrfToken(context);
      let error = context.session.get('error');
      return context.render(
        <RegisterPage
          csrfToken={csrfToken}
          error={typeof error === 'string' ? error : undefined}
        />,
      );
    },
    async action(context) {
      let parsed = s.parseSafe(registerForm, context.formData);
      if (!parsed.success) {
        let csrfToken = getCsrfToken(context);
        let emailValue = context.formData.get('email');
        return context.render(
          <RegisterPage
            csrfToken={csrfToken}
            error={parsed.issues[0]?.message ?? 'Invalid input'}
            email={typeof emailValue === 'string' ? emailValue : undefined}
          />,
          { status: 400 },
        );
      }

      let { email, password } = parsed.value;

      let existing = await db.findOne(users, { where: { email } });
      if (existing) {
        context.session.flash('error', 'Email already registered');
        return redirect('/register');
      }

      let passwordHash = await Bun.password.hash(password);
      let token = crypto.randomUUID();
      let expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      let userId = crypto.randomUUID();

      await db.transaction(async (tx) => {
        await tx.create(users, {
          id: userId,
          email,
          email_verified: false,
          verification_token: token,
          verification_expires_at: expiresAt,
          created_at: Date.now(),
        });
        await tx.create(userPasswords, {
          user_id: userId,
          password_hash: passwordHash,
          updated_at: Date.now(),
        });
      });

      let origin = new URL(context.request.url).origin;
      console.log(`${origin}/verify?token=${token}`);

      context.session.flash('error', 'Check your email to verify your account');
      return redirect('/login');
    },
  },
});

export default createController(routes.auth, {
  actions: {
    async verify(context) {
      let token = context.url.searchParams.get('token');
      if (!token) {
        context.session.flash('error', 'Invalid or expired verification link');
        return redirect('/login');
      }

      let user = await db.findOne(users, { where: { verification_token: token } });
      if (!user || user.verification_expires_at == null || user.verification_expires_at <= Date.now()) {
        context.session.flash('error', 'Invalid or expired verification link');
        return redirect('/login');
      }

      await db.update(users, user.id, {
        email_verified: true,
        verification_token: null,
        verification_expires_at: null,
      });

      context.session.flash('error', 'Email verified. You can now log in.');
      return redirect('/login');
    },
    logout(context) {
      context.session.unset('auth');
      context.session.regenerateId(true);
      return redirect('/');
    },
  },
});
