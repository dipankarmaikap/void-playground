import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { Document } from '../../document.tsx';
import { routes } from '../../../routes.ts';

export interface SessionView {
  id: string;
  current: boolean;
  device: string;
  ip: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface SettingsPageProps {
  csrfToken: string;
  sessions: SessionView[];
  error?: string;
  message?: string;
}

export function SettingsPage(handle: Handle<SettingsPageProps>) {
  return () => {
    let { csrfToken, sessions, error, message } = handle.props;
    let action = routes.app.settings.action.href();

    return (
      <Document title="Settings">
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
              maxWidth: '640px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            })}
          >
            <h1 mix={css({ margin: 0, fontSize: '24px' })}>Logged-in sessions</h1>
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

            <ul
              mix={css({
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              })}
            >
              {sessions.map((s) => (
                <li
                  key={s.id}
                  mix={css({
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  })}
                >
                  <div mix={css({ fontWeight: 600 })}>
                    {s.device} {s.current ? '(this device)' : ''}
                  </div>
                  <div mix={css({ fontSize: '13px', color: '#555' })}>IP: {s.ip}</div>
                  <div mix={css({ fontSize: '13px', color: '#555' })}>
                    Created: {s.createdAt}
                  </div>
                  <div mix={css({ fontSize: '13px', color: '#555' })}>
                    Last active: {s.lastActiveAt}
                  </div>
                  {!s.current ? (
                    <form method="post" action={action}>
                      <input type="hidden" name="_csrf" value={csrfToken} />
                      <input type="hidden" name="action" value="revoke" />
                      <input type="hidden" name="session_id" value={s.id} />
                      <button type="submit" mix={css({ padding: '6px 10px', cursor: 'pointer' })}>
                        Log out
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>

            {sessions.some((s) => !s.current) ? (
              <form method="post" action={action}>
                <input type="hidden" name="_csrf" value={csrfToken} />
                <input type="hidden" name="action" value="revoke_others" />
                <button type="submit" mix={css({ padding: '10px', cursor: 'pointer' })}>
                  Log out all other devices
                </button>
              </form>
            ) : null}

            <a href={routes.app.dashboard.href()} mix={css({ color: '#0066cc' })}>
              Back to dashboard
            </a>
          </div>
        </main>
      </Document>
    );
  };
}
