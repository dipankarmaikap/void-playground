import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import { APP_NAME } from '../config.ts';
import { routes } from '../routes.ts';
import { Document } from '../actions/document.tsx';
import { Button } from './button.tsx';
import { Icon } from './icon.tsx';
import type { IconName } from './icon.tsx';
import { identityOf } from './identity.ts';
import type { UserIdentity } from './identity.ts';
import { colors, fontFamily, radius, shadow } from './theme.ts';

export type AppSection = 'dashboard' | 'clients' | 'profile' | 'invoicing' | 'sessions';

export interface AppShellProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName?: string;
  section: AppSection;
  title: string;
  description: string;
  children: RemixNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  current: boolean;
  active: boolean;
}

interface SidebarProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName?: string;
  mainNav: NavItem[];
  settingsNav: NavItem[];
  settingsActive: boolean;
  variant: 'desktop' | 'mobile';
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

const mobileDrawerStyle = css({
  display: 'block',
  '@media (min-width: 48rem)': {
    display: 'none',
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
  '&::marker': {
    content: '""',
  },
  '&::-webkit-details-marker': {
    display: 'none',
  },
  '@media (min-width: 48rem)': {
    display: 'none',
  },
});

const sidebarBaseStyle = {
  display: 'flex',
  boxSizing: 'border-box',
  flexDirection: 'column',
  gap: '1.25rem',
  padding: '1.25rem',
  borderRight: `1px solid ${colors.border}`,
  background: colors.surface,
} as const;

const desktopSidebarStyle = css({
  ...sidebarBaseStyle,
  position: 'sticky',
  top: 0,
  height: '100vh',
  overflowY: 'auto',
  '@media (max-width: 47.999rem)': {
    display: 'none',
  },
});

const mobileSidebarStyle = css({
  ...sidebarBaseStyle,
  position: 'fixed',
  // Start below the Menu summary row so the control stays visible and tappable.
  inset: '4rem auto 0 0',
  zIndex: 20,
  width: '17rem',
  maxWidth: '85vw',
  overflowY: 'auto',
  boxShadow: shadow.card,
  '@media (min-width: 48rem)': {
    display: 'none',
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

const organizationStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.125rem',
  minWidth: 0,
  padding: '0.75rem',
  borderRadius: radius.md,
  background: colors.accentSoft,
});

const organizationLabelStyle = css({
  color: colors.muted,
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
});

const organizationNameStyle = css({
  color: colors.text,
  fontSize: '0.875rem',
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
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

function AppSidebar(handle: Handle<SidebarProps>) {
  return () => {
    let {
      csrfToken,
      identity: userIdentity,
      organizationName,
      mainNav,
      settingsNav,
      settingsActive,
      variant,
    } = handle.props;
    let identity = identityOf(userIdentity);

    return (
      <aside mix={variant === 'desktop' ? desktopSidebarStyle : mobileSidebarStyle}>
        <a href={routes.app.dashboard.href()} data-rmx-document="" mix={brandStyle}>
          {APP_NAME}
        </a>
        {organizationName ? (
          <div role="group" aria-label="Current Organization" mix={organizationStyle}>
            <span mix={organizationLabelStyle}>Organization</span>
            <span mix={organizationNameStyle}>{organizationName}</span>
          </div>
        ) : null}
        <nav aria-label="Main" mix={navStyle}>
          {mainNav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              data-rmx-document=""
              aria-current={item.current ? 'page' : undefined}
              data-active={item.active ? 'true' : undefined}
              mix={navLinkStyle}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        {settingsActive ? (
          <nav aria-label="Settings" mix={subnavStyle}>
            <p mix={subnavHeadingStyle}>Settings</p>
            {settingsNav.map((item) => (
              <a
                key={item.label}
                href={item.href}
                data-rmx-document=""
                aria-current={item.current ? 'page' : undefined}
                data-active={item.active ? 'true' : undefined}
                mix={navLinkStyle}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
        ) : null}
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
    );
  };
}

export function AppShell(handle: Handle<AppShellProps>) {
  return () => {
    let {
      csrfToken,
      identity: userIdentity,
      organizationName,
      section,
      title,
      description,
      children,
    } = handle.props;
    let settingsActive =
      section === 'profile' || section === 'invoicing' || section === 'sessions';
    let dashboardHref = routes.app.dashboard.href();
    let clientsHref = routes.app.clients.index.href();
    let profileHref = routes.app.settings.profile.index.href();
    let invoicingHref = routes.app.settings.invoicing.index.href();
    let sessionsHref = routes.app.settings.sessions.index.href();
    let mainNav: NavItem[] = [
      {
        href: dashboardHref,
        label: 'Dashboard',
        icon: 'home',
        current: section === 'dashboard',
        active: section === 'dashboard',
      },
      {
        href: clientsHref,
        label: 'Clients',
        icon: 'users',
        current: section === 'clients',
        active: section === 'clients',
      },
      {
        // The Settings main destination intentionally opens Profile.
        href: profileHref,
        label: 'Settings',
        icon: 'settings',
        current: section === 'profile',
        active: settingsActive,
      },
    ];
    let settingsNav: NavItem[] = [
      {
        href: profileHref,
        label: 'Profile',
        icon: 'user',
        current: section === 'profile',
        active: section === 'profile',
      },
      {
        href: invoicingHref,
        label: 'Invoicing',
        icon: 'receipt',
        current: section === 'invoicing',
        active: section === 'invoicing',
      },
      {
        href: sessionsHref,
        label: 'Sessions',
        icon: 'monitor',
        current: section === 'sessions',
        active: section === 'sessions',
      },
    ];

    return (
      <Document title={title} description={description} noindex>
        <a href="#main" mix={skipLinkStyle}>
          Skip to main content
        </a>
        <div mix={layoutStyle}>
          <details mix={mobileDrawerStyle}>
            <summary mix={menuStyle}>
              <Icon name="menu" />
              <span>Menu</span>
            </summary>
            <AppSidebar
              csrfToken={csrfToken}
              identity={userIdentity}
              organizationName={organizationName}
              mainNav={mainNav}
              settingsNav={settingsNav}
              settingsActive={settingsActive}
              variant="mobile"
            />
          </details>
          <AppSidebar
            csrfToken={csrfToken}
            identity={userIdentity}
            organizationName={organizationName}
            mainNav={mainNav}
            settingsNav={settingsNav}
            settingsActive={settingsActive}
            variant="desktop"
          />
          <main id="main" mix={mainStyle}>
            {children}
          </main>
        </div>
      </Document>
    );
  };
}
