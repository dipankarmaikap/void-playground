import type { Handle } from 'remix/component';

import { APP_NAME, DISPLAY_NAME_MAX_LENGTH } from '../../../config.ts';
import { routes } from '../../../routes.ts';
import { AuthLayout } from '../../../ui/auth-layout.tsx';
import { Button } from '../../../ui/button.tsx';
import { Field } from '../../../ui/field.tsx';
import { Input } from '../../../ui/input.tsx';
import {
  authHeaderStyle,
  authHeadingStyle,
  authIntroStyle,
  formStackStyle,
  noticeErrorStyle,
  pageFooterStyle,
  textLinkStyle,
} from '../../../ui/page-styles.ts';
import { Document } from '../../document.tsx';

export interface RegisterPageProps {
  csrfToken: string;
  error?: string;
  email?: string;
  displayName?: string;
}

export function RegisterPage(handle: Handle<RegisterPageProps>) {
  return () => {
    let { csrfToken, error, email, displayName } = handle.props;

    return (
      <Document
        title="Register"
        description={`Create a ${APP_NAME} account with your email address.`}
      >
        <AuthLayout>
          <header mix={authHeaderStyle}>
            <h1 mix={authHeadingStyle}>Register</h1>
            <p mix={authIntroStyle}>Create your account with your email address.</p>
          </header>
          {error ? (
            <p role="alert" mix={noticeErrorStyle}>
              {error}
            </p>
          ) : null}
          <form method="post" action={routes.auth.register.action.href()} mix={formStackStyle}>
            <input type="hidden" name="_csrf" value={csrfToken} />
            <Field label="Email">
              <Input
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={email ?? ''}
                required
              />
            </Field>
            <Field
              label="Display name (optional)"
              hint="Shown in the app instead of your email address."
            >
              <Input
                name="display_name"
                autoComplete="nickname"
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                defaultValue={displayName ?? ''}
              />
            </Field>
            <Field label="Password">
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <Button type="submit">Create account</Button>
          </form>
          <p mix={pageFooterStyle}>
            Already have an account?{' '}
            <a href={routes.auth.login.index.href()} mix={textLinkStyle}>
              Log in
            </a>
          </p>
        </AuthLayout>
      </Document>
    );
  };
}
