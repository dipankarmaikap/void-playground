import type { Handle } from 'remix/component';

import { APP_NAME } from '../../../config.ts';
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
  noticeStatusStyle,
  pageFooterStyle,
  textLinkStyle,
} from '../../../ui/page-styles.ts';
import { Document } from '../../document.tsx';

export interface LoginPageProps {
  csrfToken: string;
  error?: string;
  message?: string;
  email?: string;
}

export function LoginPage(handle: Handle<LoginPageProps>) {
  return () => {
    let { csrfToken, error, message, email } = handle.props;

    return (
      <Document title="Log in" description={`Log in to ${APP_NAME} to open your dashboard.`}>
        <AuthLayout>
          <header mix={authHeaderStyle}>
            <h1 mix={authHeadingStyle}>Log in</h1>
            <p mix={authIntroStyle}>Enter your email and password to open your dashboard.</p>
          </header>
          {error ? (
            <p role="alert" mix={noticeErrorStyle}>
              {error}
            </p>
          ) : null}
          {message ? (
            <p role="status" mix={noticeStatusStyle}>
              {message}
            </p>
          ) : null}
          <form method="post" action={routes.auth.login.action.href()} mix={formStackStyle}>
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
          <p mix={pageFooterStyle}>
            No account?{' '}
            <a href={routes.auth.register.index.href()} mix={textLinkStyle}>
              Register
            </a>
          </p>
        </AuthLayout>
      </Document>
    );
  };
}
