import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import { APP_NAME } from '../config.ts';
import { routes } from '../routes.ts';
import { Document } from '../actions/document.tsx';
import { Button } from './button.tsx';
import { Icon } from './icon.tsx';
import { identityOf } from './identity.ts';
import { colors, fontFamily, radius, shadow } from './theme.ts';

export type AppSection = 'dashboard' | 'profile' | 'sessions';

export interface AppShellProps {
  csrfToken: string;
  displayName?: string | null;
  email: string;
  section: AppSection;
  title: string;
  description: string;
  children: RemixNode;
}

const skipLinkStyle = css({
  position: 'absolute',
  top: '-100px',
  left: '1rem',
  zIndex: 30,
  padding: '0.5rem 0.875rem',
  border: `1px solid ${colors.accent}`,
  borderRadius: radius.md,
  background: colors.surface,
  color: colors.accent,
  fontWeight: 600,
  textDecoration: 'none',
  '&:focus': {
    top: '1rem',
  },
});

const layoutStyle = css({
  minHeight: '100vh',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  background: colors.background,
  color: colors.text,
  fontFamily,
  '@media (min-width: 48rem)': {
    gridTemplateColumns: '16rem minmax(0, 1fr)',
  },
});

const drawerStyle = css({
  display: 'block',
  '@media (min-width: 48rem)': {
    display: 'contents',
  },
  '@media (max-width: 47.999rem)': {
    '&:not([open]) aside': {
      display: 'none',
    },
  },
});

const menuStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  margin: '0.75rem',
  padding: '0.5rem 0.875rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  background: colors.surface,
  color: colors.text,
  fontSize: '0.9375rem',
  fontWeight: 600,
  cursor: 'pointer',
  listStyle: 'none',
  '&::-webkit-details-marker': {
    display: 'none',
  },
  '@media (min-width: 48rem)': {
    display: 'none',
  },
});

const sidebarStyle = css({
  display: 'flex',
  boxSizing: 'border-box',
  flexDirection: 'column',
  gap: '1.25rem',
  padding: '1.25rem',
  borderRight: `1px solid ${colors.border}`,
  background: colors.surface,
  '@media (min-width: 48rem)': {
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
  },
  '@media (max-width: 47.999rem)': {
    position: 'fixed',
    inset: '0 auto 0 0',
    zIndex: 20,
    width: '17rem',
    maxWidth: '85vw',
    overflowY: 'auto',
    boxShadow: shadow.card,
  },
});

const brandStyle = css({
  alignSelf: 'flex-start',
  color: colors.text,
  fontSize: '1.0625rem',
  fontWeight: 800,
  letterSpacing: '-0.02em',
  textDecoration: 'none',
  '&:hover': {
    color: colors.accent,
  },
});

const navStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
});

const navLinkStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.625rem',
  padding: '0.625rem 0.75rem',
  borderRadius: radius.md,
  color: colors.muted,
  fontSize: '0.9375rem',
  fontWeight: 500,
  textDecoration: 'none',
  '&:hover': {
    background: colors.accentSoft,
    color: colors.text,
  },
  '&[data-active="true"]': {
    background: colors.accentSoft,
    color: colors.accent,
    fontWeight: 700,
  },
});

const subnavStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
});

const subnavHeadingStyle = css({
  margin: '0 0 0.25rem 0.75rem',
  color: colors.muted,
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
});

const footerStyle = css({
  marginTop: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  paddingTop: '1rem',
  borderTop: `1px solid ${colors.border}`,
});

const identityStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.125rem',
  minWidth: 0,
});

const identityNameStyle = css({
  color: colors.text,
  fontSize: '0.875rem',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const identityEmailStyle = css({
  color: colors.muted,
  fontSize: '0.8125rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const logoutFormStyle = css({
  display: 'flex',
  '& button': {
    width: '100%',
  },
});

const mainStyle = css({
  boxSizing: 'border-box',
  width: '100%',
  maxWidth: '60rem',
  padding: '1.5rem',
  '@media (min-width: 48rem)': {
    padding: '2.5rem 3rem',
  },
});

export function AppShell(handle: Handle<AppShellProps>) {
  return () => {
    let { csrfToken, displayName, email, section, title, description, children } = handle.props;
    let identity = identityOf({ email, displayName });
    let settingsActive = section === 'profile' || section === 'sessions';
    let dashboardHref = routes.app.dashboard.href();
    let profileHref = routes.app.settings.profile.index.href();
    let sessionsHref = routes.app.settings.sessions.index.href();

    return (
      <Document title={title} description={description} noindex>
        <a href="#main" mix={skipLinkStyle}>
          Skip to main content
        </a>
        <div mix={layoutStyle}>
          <details mix={drawerStyle}>
            <summary mix={menuStyle}>
              <Icon name="menu" />
              <span>Menu</span>
            </summary>
            <aside mix={sidebarStyle}>
              <a href={dashboardHref} mix={brandStyle}>
                {APP_NAME}
              </a>
              <nav aria-label="Main" mix={navStyle}>
                <a
                  href={dashboardHref}
                  aria-current={section === 'dashboard' ? 'page' : undefined}
                  data-active={section === 'dashboard' ? 'true' : undefined}
                  mix={navLinkStyle}
                >
                  <Icon name="home" />
                  <span>Dashboard</span>
                </a>
                <a
                  href={profileHref}
                  aria-current={section === 'profile' ? 'page' : undefined}
                  data-active={settingsActive ? 'true' : undefined}
                  mix={navLinkStyle}
                >
                  <Icon name="settings" />
                  <span>Settings</span>
                </a>
              </nav>
              <nav aria-label="Settings" mix={subnavStyle}>
                <p mix={subnavHeadingStyle}>Settings</p>
                <a
                  href={profileHref}
                  aria-current={section === 'profile' ? 'page' : undefined}
                  data-active={section === 'profile' ? 'true' : undefined}
                  mix={navLinkStyle}
                >
                  <Icon name="user" />
                  <span>Profile</span>
                </a>
                <a
                  href={sessionsHref}
                  aria-current={section === 'sessions' ? 'page' : undefined}
                  data-active={section === 'sessions' ? 'true' : undefined}
                  mix={navLinkStyle}
                >
                  <Icon name="monitor" />
                  <span>Sessions</span>
                </a>
              </nav>
              <div mix={footerStyle}>
                <div mix={identityStyle}>
                  <span mix={identityNameStyle}>{identity.name}</span>
                  {identity.email ? <span mix={identityEmailStyle}>{identity.email}</span> : null}
                </div>
                <form method="post" action={routes.auth.logout.href()} mix={logoutFormStyle}>
                  <input type="hidden" name="_csrf" value={csrfToken} />
                  <Button variant="secondary">
                    <Icon name="log-out" />
                    <span>Log out</span>
                  </Button>
                </form>
              </div>
            </aside>
          </details>
          <main id="main" mix={mainStyle}>
            {children}
          </main>
        </div>
      </Document>
    );
  };
}
