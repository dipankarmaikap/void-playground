import { css } from 'remix/component';

import { Document } from './document.tsx';

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
            <a href="/login">Log in</a>
            <a href="/register">Register</a>
          </nav>
        </div>
      </main>
    </Document>
  );
}