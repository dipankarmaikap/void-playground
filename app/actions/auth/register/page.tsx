import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { Document } from '../../document.tsx';
import { routes } from '../../../routes.ts';
import { Input } from '../../../ui/input.tsx';
import { Field } from '../../../ui/field.tsx';

export interface RegisterPageProps {
  csrfToken: string;
  error?: string;
  email?: string;
}

export function RegisterPage(handle: Handle<RegisterPageProps>) {
  return () => {
    let { csrfToken, error, email } = handle.props;

    return (
      <Document title="Register">
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
            <h1 mix={css({ margin: 0, fontSize: '24px' })}>Register</h1>
            {error ? (
              <p mix={css({ margin: 0, color: '#b00020' })} role="alert">
                {error}
              </p>
            ) : null}
            <form
              method="post"
              action={routes.auth.register.action.href()}
              mix={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}
            >
              <input type="hidden" name="_csrf" value={csrfToken} />
              <Field label="Email">
                <Input name="email" type="email" defaultValue={email ?? ''} required />
              </Field>
              <Field label="Password">
                <Input name="password" type="password" minLength={8} required />
              </Field>
              <button type="submit" mix={css({ padding: '10px', cursor: 'pointer' })}>
                Create account
              </button>
            </form>
            <p mix={css({ margin: 0 })}>
              Already have an account? <a href={routes.auth.login.index.href()}>Log in</a>
            </p>
          </div>
        </main>
      </Document>
    );
  };
}
