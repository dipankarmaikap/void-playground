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
import {
  avatarColors,
  focus,
  fontStack,
  gradients,
  neutrals,
  primary,
  radii,
  shadows,
  softFills,
} from './theme.ts';

export type AppSection = 'dashboard' | 'clients' | 'invoices' | 'profile' | 'invoicing' | 'sessions';

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

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName?: string;
  mainNavGroups: NavGroup[];
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
  border: `1px solid ${primary.base}`,
  borderRadius: radii.md,
  background: neutrals.paper,
  color: primary.base,
  fontWeight: 600,
  textDecoration: 'none',
  '&:focus': {
    top: '1rem',
  },
  '&:focus-visible': {
    outline: focus.outline,
    outlineOffset: focus.offset,
  },
});

const layoutStyle = css({
  minHeight: '100vh',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  background: neutrals.canvas,
  color: neutrals.ink,
  fontFamily: fontStack,
  '@media (min-width: 48rem)': {
    gridTemplateColumns: '15.375rem minmax(0, 1fr)',
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
  border: `1px solid ${neutrals.line}`,
  borderRadius: radii.md,
  background: neutrals.paper,
  color: neutrals.ink,
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
  '&:focus-visible': {
    outline: focus.outline,
    outlineOffset: focus.offset,
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
  padding: '1.5rem 0.9375rem 1rem',
  borderRight: `1px solid ${neutrals.line}`,
  background: neutrals.paper,
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
  boxShadow: shadows.large,
  '@media (min-width: 48rem)': {
    display: 'none',
  },
});

const brandStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.625rem',
  alignSelf: 'flex-start',
  color: neutrals.ink,
  fontSize: '1.3125rem',
  fontWeight: 800,
  // The reference brand wordmark tracks tighter than the page headings.
  letterSpacing: '-0.035em',
  textDecoration: 'none',
  '&:hover': {
    color: primary.base,
  },
  '&:focus-visible': {
    outline: focus.outline,
    outlineOffset: focus.offset,
    borderRadius: radii.md,
  },
});

const brandMarkStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  width: '2.125rem',
  height: '2.125rem',
  borderRadius: radii.lg,
  background: gradients.brandMark,
  boxShadow: shadows.brandMark,
  color: neutrals.paper,
  fontSize: '0.875rem',
  fontWeight: 800,
});

const workspaceStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.625rem',
  minWidth: 0,
  padding: '0.625rem',
  border: `1px solid ${neutrals.line}`,
  borderRadius: radii.xl,
  background: neutrals.paper,
});

const workspaceAvatarStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxSizing: 'border-box',
  width: '2rem',
  height: '2rem',
  borderRadius: radii.md,
  background: softFills.workspaceAvatar.background,
  color: softFills.workspaceAvatar.color,
  fontSize: '0.875rem',
  fontWeight: 800,
});

const workspaceMetaStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.0625rem',
  minWidth: 0,
});

const workspaceLabelStyle = css({
  color: neutrals.softMuted,
  fontSize: '0.625rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
});

const workspaceNameStyle = css({
  color: neutrals.ink,
  fontSize: '0.8125rem',
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const navStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
});

const navGroupStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.125rem',
});

const navLabelStyle = css({
  margin: '0 0 0.25rem 0.5rem',
  color: neutrals.softMuted,
  fontSize: '0.6875rem',
  fontWeight: 800,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
});

const navLinkStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.6875rem',
  boxSizing: 'border-box',
  minHeight: '2.5rem',
  padding: '0.5rem 0.6875rem',
  borderRadius: radii.md,
  color: neutrals.muted,
  fontSize: '0.875rem',
  fontWeight: 600,
  textDecoration: 'none',
  '&:hover': {
    background: primary.soft,
    color: primary.base,
  },
  '&[data-active="true"]': {
    background: primary.soft,
    color: primary.base,
    fontWeight: 700,
  },
  '&:focus-visible': {
    outline: focus.outline,
    outlineOffset: focus.offset,
  },
});

const navIconStyle = css({
  display: 'inline-flex',
  flexShrink: 0,
  '& svg': {
    width: '1.0625rem',
    height: '1.0625rem',
  },
});

const subnavStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.125rem',
});

const footerStyle = css({
  marginTop: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.875rem',
  paddingTop: '1rem',
  borderTop: `1px solid ${neutrals.line}`,
});

const helpCardStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.375rem',
  padding: '0.875rem',
  borderRadius: radii.xl,
  background: gradients.helpCard,
  color: neutrals.ink,
});

const helpTitleStyle = css({
  fontSize: '0.8125rem',
  fontWeight: 800,
});

const helpTextStyle = css({
  margin: 0,
  color: neutrals.muted,
  fontSize: '0.75rem',
  lineHeight: 1.45,
});

const profileStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.625rem',
  minWidth: 0,
});

const avatarStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxSizing: 'border-box',
  width: '2rem',
  height: '2rem',
  borderRadius: '999px',
  background: avatarColors.default.background,
  color: avatarColors.default.color,
  fontSize: '0.625rem',
  fontWeight: 800,
});

const profileNameStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.0625rem',
  minWidth: 0,
});

const identityNameStyle = css({
  color: neutrals.ink,
  fontSize: '0.8125rem',
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const identityEmailStyle = css({
  color: neutrals.muted,
  fontSize: '0.75rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const logoutFormStyle = css({
  display: 'flex',
  '& button': {
    width: '100%',
  },
  '& button:focus-visible': {
    outline: focus.outline,
    outlineOffset: focus.offset,
  },
});

const mainAreaStyle = css({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
});

const topbarStyle = css({
  position: 'sticky',
  top: 0,
  zIndex: 3,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  boxSizing: 'border-box',
  minHeight: '4.25rem',
  padding: '0 2.25rem',
  borderBottom: `1px solid ${neutrals.line}`,
  background: neutrals.paper,
  '@media (max-width: 47.999rem)': {
    position: 'static',
    minHeight: '3.5rem',
    padding: '0 1rem',
  },
});

const breadcrumbStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '0.5rem',
  minWidth: 0,
  fontSize: '0.8125rem',
});

const breadcrumbSegmentStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  minWidth: 0,
});

const breadcrumbSeparatorStyle = css({
  color: neutrals.softMuted,
});

const breadcrumbLinkStyle = css({
  color: neutrals.muted,
  textDecoration: 'none',
  '&:hover': {
    color: primary.base,
  },
  '&:focus-visible': {
    outline: focus.outline,
    outlineOffset: focus.offset,
    borderRadius: radii.sm,
  },
});

const breadcrumbCurrentStyle = css({
  color: neutrals.ink,
  fontWeight: 700,
});

const topbarIdentityStyle = css({
  color: neutrals.muted,
  fontSize: '0.8125rem',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const mainStyle = css({
  boxSizing: 'border-box',
  width: '100%',
  maxWidth: '90rem',
  margin: '0 auto',
  padding: '2rem 2.25rem 3.4375rem',
  '@media (max-width: 47.999rem)': {
    padding: '1.5rem 1rem 2.5rem',
  },
});

function initialsOf(value: string) {
  let parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function NavLink(handle: Handle<NavItem>) {
  return () => {
    let { href, label, icon, current, active } = handle.props;

    return (
      <a
        href={href}
        data-rmx-document=""
        aria-current={current ? 'page' : undefined}
        data-active={active ? 'true' : undefined}
        mix={navLinkStyle}
      >
        <span aria-hidden="true" mix={navIconStyle}>
          <Icon name={icon} />
        </span>
        <span>{label}</span>
      </a>
    );
  };
}

function AppSidebar(handle: Handle<SidebarProps>) {
  return () => {
    let {
      csrfToken,
      identity: userIdentity,
      organizationName,
      mainNavGroups,
      settingsNav,
      settingsActive,
      variant,
    } = handle.props;
    let identity = identityOf(userIdentity);
    let workspaceInitial = organizationName?.trim().charAt(0).toUpperCase() ?? '';

    return (
      <aside
        aria-label={`${APP_NAME} workspace`}
        mix={variant === 'desktop' ? desktopSidebarStyle : mobileSidebarStyle}
      >
        <a href={routes.app.dashboard.href()} data-rmx-document="" mix={brandStyle}>
          <span aria-hidden="true" mix={brandMarkStyle}>
            {APP_NAME.charAt(0)}
          </span>
          <span>{APP_NAME}</span>
        </a>
        {organizationName ? (
          <div role="group" aria-label="Current Organization" mix={workspaceStyle}>
            <span aria-hidden="true" mix={workspaceAvatarStyle}>
              {workspaceInitial}
            </span>
            <span mix={workspaceMetaStyle}>
              <span mix={workspaceLabelStyle}>Organization</span>
              <strong mix={workspaceNameStyle}>{organizationName}</strong>
            </span>
          </div>
        ) : null}
        <nav aria-label="Main" mix={navStyle}>
          {mainNavGroups.map((group) => (
            <div key={group.label} mix={navGroupStyle}>
              <span mix={navLabelStyle}>{group.label}</span>
              {group.items.map((item) => (
                <NavLink key={item.label} {...item} />
              ))}
            </div>
          ))}
        </nav>
        {settingsActive ? (
          <nav aria-label="Settings" mix={subnavStyle}>
            <span mix={navLabelStyle}>Settings</span>
            {settingsNav.map((item) => (
              <NavLink key={item.label} {...item} />
            ))}
          </nav>
        ) : null}
        <div mix={footerStyle}>
          <div mix={helpCardStyle}>
            <strong mix={helpTitleStyle}>A little help?</strong>
            <p mix={helpTextStyle}>
              Manage your Clients, Invoices, and Organization settings from one place.
            </p>
          </div>
          <div mix={profileStyle}>
            <span aria-hidden="true" mix={avatarStyle}>
              {initialsOf(identity.name)}
            </span>
            <span mix={profileNameStyle}>
              <strong mix={identityNameStyle}>{identity.name}</strong>
              {identity.email ? <span mix={identityEmailStyle}>{identity.email}</span> : null}
            </span>
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
    let identity = identityOf(userIdentity);
    let settingsActive =
      section === 'profile' || section === 'invoicing' || section === 'sessions';
    let dashboardHref = routes.app.dashboard.href();
    let clientsHref = routes.app.clients.index.href();
    let invoicesHref = routes.app.invoices.index.href();
    let profileHref = routes.app.settings.profile.index.href();
    let invoicingHref = routes.app.settings.invoicing.index.href();
    let sessionsHref = routes.app.settings.sessions.index.href();

    let mainNavGroups: NavGroup[] = [
      {
        label: 'Overview',
        items: [
          {
            href: dashboardHref,
            label: 'Dashboard',
            icon: 'home',
            current: section === 'dashboard',
            active: section === 'dashboard',
          },
        ],
      },
      {
        label: 'Manage',
        items: [
          {
            href: clientsHref,
            label: 'Clients',
            icon: 'users',
            current: section === 'clients',
            active: section === 'clients',
          },
        ],
      },
      {
        label: 'Invoicing',
        items: [
          {
            href: invoicesHref,
            label: 'Invoices',
            icon: 'receipt',
            current: section === 'invoices',
            active: section === 'invoices',
          },
        ],
      },
      {
        label: 'Workspace',
        items: [
          {
            // The Settings main destination intentionally opens Profile.
            href: profileHref,
            label: 'Settings',
            icon: 'settings',
            current: section === 'profile',
            active: settingsActive,
          },
        ],
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

    // The breadcrumb parent comes from the section's own navigation item, not from comparing
    // the page title to a hard-coded label. Renaming a page title can never drop its section.
    let sectionItem = mainNavGroups.flatMap((group) => group.items).find((item) => item.active);
    let breadcrumbParents: { label: string; href: string }[] =
      section === 'dashboard' || !sectionItem
        ? []
        : [{ label: sectionItem.label, href: sectionItem.href }];

    let sidebarProps = {
      csrfToken,
      identity: userIdentity,
      organizationName,
      mainNavGroups,
      settingsNav,
      settingsActive,
    };

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
            <AppSidebar {...sidebarProps} variant="mobile" />
          </details>
          <AppSidebar {...sidebarProps} variant="desktop" />
          <div mix={mainAreaStyle}>
            <header mix={topbarStyle}>
              <nav aria-label="Breadcrumb" mix={breadcrumbStyle}>
                <a href={dashboardHref} data-rmx-document="" mix={breadcrumbLinkStyle}>
                  {APP_NAME}
                </a>
                {breadcrumbParents.map((parent) => (
                  <span key={parent.href} mix={breadcrumbSegmentStyle}>
                    <span aria-hidden="true" mix={breadcrumbSeparatorStyle}>
                      /
                    </span>
                    <a href={parent.href} data-rmx-document="" mix={breadcrumbLinkStyle}>
                      {parent.label}
                    </a>
                  </span>
                ))}
                <span mix={breadcrumbSegmentStyle}>
                  <span aria-hidden="true" mix={breadcrumbSeparatorStyle}>
                    /
                  </span>
                  <strong aria-current="page" mix={breadcrumbCurrentStyle}>
                    {title}
                  </strong>
                </span>
              </nav>
              <span mix={topbarIdentityStyle}>{identity.name}</span>
            </header>
            <main id="main" mix={mainStyle}>
              {children}
            </main>
          </div>
        </div>
      </Document>
    );
  };
}
