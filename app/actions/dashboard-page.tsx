import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { Document } from './document.tsx';

export interface DashboardPageProps {
  csrfToken: string;
  email?: string;
  error?: string;
}

export function DashboardPage(handle: Handle<DashboardPageProps>) {
  return () => {
    let { csrfToken, email, error } = handle.props;

    return (
      <Document title="Dashboard">
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
            <h1 mix={css({ margin: 0, fontSize: '24px' })}>Dashboard</h1>
            {error ? (
              <p mix={css({ margin: 0, color: '#b00020' })} role="alert">
                {error}
              </p>
            ) : null}
            <p mix={css({ margin: 0 })}>Signed in as {email}</p>
            <form
              method="post"
              action="/logout"
              mix={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}
            >
              <input type="hidden" name="_csrf" value={csrfToken} />
              <button type="submit" mix={css({ padding: '10px', cursor: 'pointer' })}>
                Log out
              </button>
            </form>
          </div>
        </main>
      </Document>
    );
  };
}