import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { APP_NAME } from '../config.ts';
import { routes } from '../routes.ts';
import { linkButtonStyle } from '../ui/button.tsx';
import { publicScreenStyle } from '../ui/page-styles.ts';
import { colors } from '../ui/theme.ts';
import { Document } from './document.tsx';

export interface HomePageProps {
  authenticated: boolean;
}

const welcomeStyle = css({
  width: '100%',
  maxWidth: '40rem',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1rem',
  textAlign: 'center',
});

const brandStyle = css({
  margin: 0,
  color: colors.accent,
  fontSize: '0.875rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
});

const headingStyle = css({
  margin: 0,
  fontSize: '2.5rem',
  lineHeight: 1.1,
  letterSpacing: '-0.02em',
});

const introStyle = css({
  margin: 0,
  maxWidth: '32rem',
  color: colors.muted,
  fontSize: '1.125rem',
  lineHeight: 1.6,
});

const actionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '0.75rem',
  marginTop: '0.5rem',
});

export function HomePage(handle: Handle<HomePageProps>) {
  return () => {
    let { authenticated } = handle.props;

    return (
      <Document
        title="Home"
        description={`Welcome to ${APP_NAME}. Create an account or log in to get started.`}
        social
      >
        <main mix={publicScreenStyle}>
          <div mix={welcomeStyle}>
            <p mix={brandStyle}>{APP_NAME}</p>
            <h1 mix={headingStyle}>Welcome to {APP_NAME}</h1>
            <p mix={introStyle}>Create an account or log in to get started.</p>
            {authenticated ? (
              <nav aria-label="Your account" mix={actionsStyle}>
                <a href={routes.app.dashboard.href()} mix={linkButtonStyle}>
                  Go to dashboard
                </a>
                <a
                  href={routes.auth.register.index.href()}
                  data-variant="secondary"
                  mix={linkButtonStyle}
                >
                  Create account
                </a>
                <a
                  href={routes.auth.login.index.href()}
                  data-variant="secondary"
                  mix={linkButtonStyle}
                >
                  Log in
                </a>
              </nav>
            ) : (
              <nav aria-label="Get started" mix={actionsStyle}>
                <a href={routes.auth.register.index.href()} mix={linkButtonStyle}>
                  Create account
                </a>
                <a
                  href={routes.auth.login.index.href()}
                  data-variant="secondary"
                  mix={linkButtonStyle}
                >
                  Log in
                </a>
              </nav>
            )}
          </div>
        </main>
      </Document>
    );
  };
}
