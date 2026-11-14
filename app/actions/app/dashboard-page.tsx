import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { APP_NAME } from '../../config.ts';
import { routes } from '../../routes.ts';
import { AppShell } from '../../ui/app-shell.tsx';
import { Icon } from '../../ui/icon.tsx';
import { identityOf } from '../../ui/identity.ts';
import type { UserIdentity } from '../../ui/identity.ts';
import { colors, radius, shadow } from '../../ui/theme.ts';

export interface DashboardPageProps {
  csrfToken: string;
  identity: UserIdentity;
}

const headerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginBottom: '2rem',
});

const headingStyle = css({
  margin: 0,
  fontSize: '2rem',
  lineHeight: 1.2,
  letterSpacing: '-0.02em',
  overflowWrap: 'anywhere',
});

const introStyle = css({
  margin: 0,
  color: colors.muted,
  fontSize: '1rem',
  lineHeight: 1.6,
});

const sectionHeadingStyle = css({
  margin: '0 0 0.75rem',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: colors.muted,
});

const shortcutListStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: '0.75rem',
  gridTemplateColumns: 'minmax(0, 1fr)',
  '@media (min-width: 36rem)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
});

const shortcutStyle = css({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
  padding: '1rem 1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  boxShadow: shadow.card,
  color: colors.text,
  textDecoration: 'none',
  '&:hover': {
    borderColor: colors.accent,
    background: colors.accentSoft,
  },
});

const shortcutIconStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '2.25rem',
  height: '2.25rem',
  borderRadius: radius.md,
  background: colors.accentSoft,
  color: colors.accent,
  flexShrink: 0,
});

const shortcutBodyStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.125rem',
});

const shortcutTitleStyle = css({
  fontSize: '0.9375rem',
  fontWeight: 700,
});

const shortcutDescriptionStyle = css({
  color: colors.muted,
  fontSize: '0.875rem',
  lineHeight: 1.5,
});

export function DashboardPage(handle: Handle<DashboardPageProps>) {
  return () => {
    let { csrfToken, identity: userIdentity } = handle.props;
    let identity = identityOf(userIdentity);

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={userIdentity}
        section="dashboard"
        title="Dashboard"
        description={`Your ${APP_NAME} dashboard and shortcuts.`}
      >
        <header mix={headerStyle}>
          <h1 mix={headingStyle}>Welcome back, {identity.name}</h1>
          <p mix={introStyle}>You are signed in as {userIdentity.email}.</p>
        </header>
        <section aria-labelledby="shortcuts-heading">
          <h2 id="shortcuts-heading" mix={sectionHeadingStyle}>
            Shortcuts
          </h2>
          <ul mix={shortcutListStyle}>
            <li>
              <a href={routes.app.settings.profile.index.href()} mix={shortcutStyle}>
                <span mix={shortcutIconStyle}>
                  <Icon name="user" />
                </span>
                <span mix={shortcutBodyStyle}>
                  <span mix={shortcutTitleStyle}>Profile settings</span>
                  <span mix={shortcutDescriptionStyle}>
                    Review your account identity and display name.
                  </span>
                </span>
              </a>
            </li>
            <li>
              <a href={routes.app.settings.sessions.index.href()} mix={shortcutStyle}>
                <span mix={shortcutIconStyle}>
                  <Icon name="monitor" />
                </span>
                <span mix={shortcutBodyStyle}>
                  <span mix={shortcutTitleStyle}>Sessions</span>
                  <span mix={shortcutDescriptionStyle}>
                    Review the browsers signed in to your account.
                  </span>
                </span>
              </a>
            </li>
          </ul>
        </section>
      </AppShell>
    );
  };
}
