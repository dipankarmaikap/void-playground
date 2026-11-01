import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { Document } from '../../document.tsx';
import { routes } from '../../../routes.ts';
import { Input } from '../../../ui/input.tsx';
import { Field } from '../../../ui/field.tsx';

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
      <Document title="Login">
        <main
          mix={css({
            margin: 0,
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'system-ui, sans-serif',
          })}
        >
          <div
            mix={css({
              width: '100%',
              maxWidth: '360px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            })}
          >
            <h1 mix={css({ margin: 0, fontSize: '24px' })}>Login</h1>
            {error ? (
              <p mix={css({ margin: 0, color: '#b00020' })} role="alert">
                {error}
              </p>
            ) : null}
            {message ? (
              <p mix={css({ margin: 0, color: '#0a7d2b' })} role="status">
                {message}
              </p>
            ) : null}
            <form
              method="post"
              action={routes.auth.login.action.href()}
              mix={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}
            >
              <input type="hidden" name="_csrf" value={csrfToken} />
              <Field label="Email">
                <Input name="email" type="email" defaultValue={email ?? ''} required />
              </Field>
              <Field label="Password">
                <Input name="password" type="password" required />
              </Field>
              <button type="submit" mix={css({ padding: '10px', cursor: 'pointer' })}>
                Log in
              </button>
            </form>
            <p mix={css({ margin: 0 })}>
              No account? <a href={routes.auth.register.index.href()}>Register</a>
            </p>
          </div>
        </main>
      </Document>
    );
  };
}
