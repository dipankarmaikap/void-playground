import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import * as s from 'remix/data-schema';
import * as f from 'remix/data-schema/form-data';
import * as checks from 'remix/data-schema/checks';

import { Auth } from 'remix/middleware/auth';
import type { AuthState } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import { db, users, userPasswords } from '../../../data/db.ts';
import type { User } from '../../../data/db.ts';
import { hashPassword } from '../../../data/password.ts';
import { DISPLAY_NAME_MAX_LENGTH } from '../../../config.ts';
import { routes } from '../../../routes.ts';
import { RegisterPage } from './page.tsx';

const registerForm = f.object({
  email: f.field(s.string().pipe(checks.email())),
  display_name: f.field(s.defaulted(s.string(), '')),
  password: f.field(s.string().pipe(checks.minLength(8))),
});

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}

export default createController(routes.auth.register, {
  actions: {
    async index(context) {
      let auth = context.get(Auth) as AuthState<User>;
      if (auth?.ok) {
        return redirect(routes.app.dashboard.href());
      }
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
      let emailValue = context.formData.get('email');
      let submittedEmail = typeof emailValue === 'string' ? emailValue : undefined;
      let displayNameValue = context.formData.get('display_name');
      let submittedDisplayName =
        typeof displayNameValue === 'string' ? displayNameValue : undefined;

      let parsed = s.parseSafe(registerForm, context.formData);
      if (!parsed.success) {
        let csrfToken = getCsrfToken(context);
        return context.render(
          <RegisterPage
            csrfToken={csrfToken}
            error={parsed.issues[0]?.message ?? 'Invalid input'}
            email={submittedEmail}
            displayName={submittedDisplayName}
          />,
          { status: 400 },
        );
      }

      let displayName = parsed.value.display_name.trim();
      if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
        let csrfToken = getCsrfToken(context);
        return context.render(
          <RegisterPage
            csrfToken={csrfToken}
            error={`Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`}
            email={submittedEmail}
            displayName={submittedDisplayName}
          />,
          { status: 400 },
        );
      }

      let email = parsed.value.email.trim().toLowerCase();
      let password = parsed.value.password;

      let existing = await db.findOne(users, { where: { email } });
      if (existing) {
        context.session.flash('error', 'Email already registered');
        return redirect(routes.auth.register.index.href());
      }

      let passwordHash = hashPassword(password);
      let token = crypto.randomUUID();
      let expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      let userId = crypto.randomUUID();

      try {
        await db.transaction(async (tx) => {
          await tx.create(users, {
            id: userId,
            email,
            display_name: displayName || null,
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
      } catch (error) {
        if (isUniqueViolation(error)) {
          context.session.flash('error', 'Email already registered');
          return redirect(routes.auth.register.index.href());
        }
        throw error;
      }

      let verifyUrl = new URL(routes.auth.verify.href(), new URL(context.request.url).origin);
      verifyUrl.searchParams.set('token', token);
      console.log(verifyUrl.href);

      context.session.flash('message', 'Check your email to verify your account');
      return redirect(routes.auth.login.index.href());
    },
  },
});
