import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { APP_NAME } from '../../../config.ts';
import { routes } from '../../../routes.ts';
import { AuthLayout } from '../../../ui/auth-layout.tsx';
import { Button } from '../../../ui/button.tsx';
import { Field } from '../../../ui/field.tsx';
import { Input } from '../../../ui/input.tsx';
import { colors, radius } from '../../../ui/theme.ts';
import { Document } from '../../document.tsx';

export interface LoginPageProps {
  csrfToken: string;
  error?: string;
  message?: string;
  email?: string;
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

const statusStyle = css({
  margin: 0,
  padding: '10px 12px',
  border: `1px solid ${colors.success}`,
  borderRadius: radius.sm,
  background: colors.successSoft,
  color: colors.success,
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

export function LoginPage(handle: Handle<LoginPageProps>) {
  return () => {
    let { csrfToken, error, message, email } = handle.props;

    return (
      <Document title="Log in" description={`Log in to ${APP_NAME} to open your dashboard.`}>
        <AuthLayout>
          <header mix={headerStyle}>
            <h1 mix={headingStyle}>Log in</h1>
            <p mix={subtitleStyle}>Enter your email and password to open your dashboard.</p>
          </header>
          {error ? (
            <p role="alert" mix={errorStyle}>
              {error}
            </p>
          ) : null}
          {message ? (
            <p role="status" mix={statusStyle}>
              {message}
            </p>
          ) : null}
          <form method="post" action={routes.auth.login.action.href()} mix={formStyle}>
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
            <Field label="Password">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
            <Button type="submit">Log in</Button>
          </form>
          <p mix={footerStyle}>
            No account?{' '}
            <a href={routes.auth.register.index.href()} mix={linkStyle}>
              Register
            </a>
          </p>
        </AuthLayout>
      </Document>
    );
  };
}
