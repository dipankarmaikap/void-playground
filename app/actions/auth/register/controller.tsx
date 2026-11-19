import { createController } from 'remix/router';
import { redirect } from 'remix/response/redirect';

import * as s from 'remix/data-schema';
import * as f from 'remix/data-schema/form-data';
import * as checks from 'remix/data-schema/checks';

import { Auth } from 'remix/middleware/auth';
import type { AuthState } from 'remix/middleware/auth';
import { getCsrfToken } from 'remix/middleware/csrf';

import {
  organizationMemberships,
  organizationGstRatePresets,
  organizations,
  users,
  userPasswords,
} from '../../../data/db.ts';
import type { User } from '../../../data/db.ts';
import { parseDisplayName } from '../../../data/display-name.ts';
import { defaultGstPresetRows } from '../../../data/organization/gst-presets.ts';
import { parseOrganizationName } from '../../../data/organization/name.ts';
import { hashPassword } from '../../../data/password.ts';
import { routes } from '../../../routes.ts';
import { RegisterPage } from './page.tsx';

const registerForm = f.object({
  email: f.field(s.string().pipe(checks.email())),
  organization_name: f.field(s.defaulted(s.string(), '')),
  display_name: f.field(s.defaulted(s.string(), '')),
  password: f.field(s.string().pipe(checks.minLength(8))),
});

function isDuplicateEmailViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed: users.email');
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
      let organizationNameValue = context.formData.get('organization_name');
      let submittedOrganizationName =
        typeof organizationNameValue === 'string' ? organizationNameValue : undefined;
      let renderInvalidRegistration = (error: string) =>
        context.render(
          <RegisterPage
            csrfToken={getCsrfToken(context)}
            error={error}
            email={submittedEmail}
            displayName={submittedDisplayName}
            organizationName={submittedOrganizationName}
          />,
          { status: 400 },
        );

      let parsed = s.parseSafe(registerForm, context.formData);
      if (!parsed.success) {
        return renderInvalidRegistration(parsed.issues[0]?.message ?? 'Invalid input');
      }

      let displayName = parseDisplayName(parsed.value.display_name);
      if (!displayName.ok) {
        return renderInvalidRegistration(displayName.error);
      }

      let organizationName = parseOrganizationName(parsed.value.organization_name);
      if (!organizationName.ok) {
        return renderInvalidRegistration(organizationName.error);
      }

      let email = parsed.value.email.trim().toLowerCase();
      let password = parsed.value.password;

      let existing = await context.db.findOne(users, { where: { email } });
      if (existing) {
        context.session.flash('error', 'Email already registered');
        return redirect(routes.auth.register.index.href());
      }

      let passwordHash = hashPassword(password);
      let token = crypto.randomUUID();
      let expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      let userId = crypto.randomUUID();
      let organizationId = crypto.randomUUID();
      let now = Date.now();

      try {
        await context.db.transaction(async (tx) => {
          await tx.create(users, {
            id: userId,
            email,
            display_name: displayName.value,
            email_verified: false,
            verification_token: token,
            verification_expires_at: expiresAt,
            created_at: now,
          });
          await tx.create(userPasswords, {
            user_id: userId,
            password_hash: passwordHash,
            updated_at: now,
          });
          await tx.create(organizations, {
            id: organizationId,
            name: organizationName.value,
            created_at: now,
            updated_at: now,
          });
          await tx.create(organizationMemberships, {
            id: crypto.randomUUID(),
            organization_id: organizationId,
            user_id: userId,
            is_owner: true,
            created_at: now,
          });
          for (let preset of defaultGstPresetRows(organizationId, now)) {
            await tx.create(organizationGstRatePresets, preset);
          }
        });
      } catch (error) {
        if (isDuplicateEmailViolation(error)) {
          context.session.flash('error', 'Email already registered');
          return redirect(routes.auth.register.index.href());
        }
        throw error;
      }

      let verifyUrl = new URL(
        routes.auth.verify.index.href(),
        new URL(context.request.url).origin,
      );
      verifyUrl.searchParams.set('token', token);
      console.log(verifyUrl.href);

      context.session.flash('message', 'Check your email to verify your account');
      return redirect(routes.auth.login.index.href());
    },
  },
});
