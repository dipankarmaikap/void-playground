import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { Document } from '../document.tsx';

export interface LoginPageProps {
  csrfToken: string;
  error?: string;
  email?: string;
}

export function LoginPage(handle: Handle<LoginPageProps>) {
  return () => {
    let { csrfToken, error, email } = handle.props;

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
            <form
              method="post"
              action="/login"
              mix={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}
            >
              <input type="hidden" name="_csrf" value={csrfToken} />
              <label mix={css({ display: 'flex', flexDirection: 'column', gap: '4px' })}>
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={email ?? ''}
                  required
                  mix={css({ padding: '8px' })}
                />
              </label>
              <label mix={css({ display: 'flex', flexDirection: 'column', gap: '4px' })}>
                Password
                <input name="password" type="password" required mix={css({ padding: '8px' })} />
              </label>
              <button type="submit" mix={css({ padding: '10px', cursor: 'pointer' })}>
                Log in
              </button>
            </form>
            <p mix={css({ margin: 0 })}>
              No account? <a href="/register">Register</a>
            </p>
          </div>
        </main>
      </Document>
    );
  };
}