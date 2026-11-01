import { css } from 'remix/component';

import { Document } from './document.tsx';
import { routes } from '../routes.ts';

export function HomePage() {
  return () => (
    <Document title="Home">
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
            gap: '12px',
            alignItems: 'center',
            textAlign: 'center',
          })}
        >
          <h1 mix={css({ margin: 0, fontSize: '24px' })}>Welcome</h1>
          <p mix={css({ margin: 0 })}>Sign in to continue.</p>
          <nav mix={css({ display: 'flex', gap: '12px' })}>
            <a href={routes.auth.login.index.href()}>Log in</a>
            <a href={routes.auth.register.index.href()}>Register</a>
          </nav>
        </div>
      </main>
    </Document>
  );
}
