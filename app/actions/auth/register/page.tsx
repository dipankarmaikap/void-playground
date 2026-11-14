import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { APP_NAME, DISPLAY_NAME_MAX_LENGTH } from '../../../config.ts';
import { routes } from '../../../routes.ts';
import { AuthLayout } from '../../../ui/auth-layout.tsx';
import { Button } from '../../../ui/button.tsx';
import { Field } from '../../../ui/field.tsx';
import { Input } from '../../../ui/input.tsx';
import { colors, radius } from '../../../ui/theme.ts';
import { Document } from '../../document.tsx';

export interface RegisterPageProps {
  csrfToken: string;
  error?: string;
  email?: string;
  displayName?: string;
}

const headerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.375rem',
});

const headingStyle = css({
  margin: 0,
  fontSize: '1.5rem',
  lineHeight: 1.2,
});

const subtitleStyle = css({
  margin: 0,
  color: colors.muted,
  fontSize: '0.9375rem',
  lineHeight: 1.5,
});

const errorStyle = css({
  margin: 0,
  padding: '10px 12px',
  border: `1px solid ${colors.danger}`,
  borderRadius: radius.sm,
  background: colors.dangerSoft,
  color: colors.danger,
  fontSize: '0.875rem',
});

const formStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
});

const footerStyle = css({
  margin: 0,
  color: colors.muted,
  fontSize: '0.875rem',
});

const linkStyle = css({
  color: colors.accent,
  fontWeight: 600,
  textDecoration: 'none',
  '&:hover': {
    color: colors.accentHover,
    textDecoration: 'underline',
  },
});

export function RegisterPage(handle: Handle<RegisterPageProps>) {
  return () => {
    let { csrfToken, error, email, displayName } = handle.props;

    return (
      <Document
        title="Register"
        description={`Create a ${APP_NAME} account with your email address.`}
      >
        <AuthLayout>
          <header mix={headerStyle}>
            <h1 mix={headingStyle}>Register</h1>
            <p mix={subtitleStyle}>Create your account with your email address.</p>
          </header>
          {error ? (
            <p role="alert" mix={errorStyle}>
              {error}
            </p>
          ) : null}
          <form method="post" action={routes.auth.register.action.href()} mix={formStyle}>
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
          <p mix={footerStyle}>
            Already have an account?{' '}
            <a href={routes.auth.login.index.href()} mix={linkStyle}>
              Log in
            </a>
          </p>
        </AuthLayout>
      </Document>
    );
  };
}
