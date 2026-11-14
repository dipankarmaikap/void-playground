import type { Handle } from 'remix/component';

import { APP_NAME } from '../../../config.ts';
import { routes } from '../../../routes.ts';
import { AuthLayout } from '../../../ui/auth-layout.tsx';
import { Button } from '../../../ui/button.tsx';
import {
  authHeaderStyle,
  authHeadingStyle,
  authIntroStyle,
  formStackStyle,
  pageFooterStyle,
  textLinkStyle,
} from '../../../ui/page-styles.ts';
import { Document } from '../../document.tsx';

interface VerifyEmailPageProps {
  csrfToken: string;
  token: string;
}

export function VerifyEmailPage(handle: Handle<VerifyEmailPageProps>) {
  return () => {
    let { csrfToken, token } = handle.props;

    return (
      <Document
        title="Verify your email"
        description={`Confirm your email address to finish creating a ${APP_NAME} account.`}
      >
        <AuthLayout>
          <header mix={authHeaderStyle}>
            <h1 mix={authHeadingStyle}>Verify your email</h1>
            <p mix={authIntroStyle}>
              Confirm that you control this email address to finish creating your account.
            </p>
          </header>
          <form method="post" action={routes.auth.verify.action.href()} mix={formStackStyle}>
            <input type="hidden" name="_csrf" value={csrfToken} />
            <input type="hidden" name="token" value={token} />
            <Button type="submit">Confirm email address</Button>
          </form>
          <p mix={pageFooterStyle}>
            Already verified?{' '}
            <a href={routes.auth.login.index.href()} mix={textLinkStyle}>
              Log in
            </a>
          </p>
        </AuthLayout>
      </Document>
    );
  };
}
