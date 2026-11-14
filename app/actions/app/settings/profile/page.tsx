import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { AppShell } from '../../../../ui/app-shell.tsx';
import { colors, radius, shadow } from '../../../../ui/theme.ts';

export interface ProfilePageProps {
  csrfToken: string;
  email: string;
  displayName?: string | null;
  error?: string;
  message?: string;
}

const headerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginBottom: '1.5rem',
});

const headingStyle = css({
  margin: 0,
  fontSize: '1.75rem',
  lineHeight: 1.2,
  letterSpacing: '-0.02em',
});

const introStyle = css({
  margin: 0,
  color: colors.muted,
  fontSize: '0.9375rem',
  lineHeight: 1.6,
});

const errorStyle = css({
  margin: '0 0 1rem',
  padding: '10px 12px',
  border: `1px solid ${colors.danger}`,
  borderRadius: radius.sm,
  background: colors.dangerSoft,
  color: colors.danger,
  fontSize: '0.875rem',
});

const statusStyle = css({
  margin: '0 0 1rem',
  padding: '10px 12px',
  border: `1px solid ${colors.success}`,
  borderRadius: radius.sm,
  background: colors.successSoft,
  color: colors.success,
  fontSize: '0.875rem',
});

const cardStyle = css({
  padding: '1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  boxShadow: shadow.card,
});

const cardHeadingStyle = css({
  margin: '0 0 1rem',
  fontSize: '1rem',
  fontWeight: 700,
});

const listStyle = css({
  margin: 0,
  display: 'grid',
  gap: '0.75rem',
});

const termStyle = css({
  color: colors.muted,
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
});

const detailStyle = css({
  margin: '0.125rem 0 0',
  fontSize: '0.9375rem',
  overflowWrap: 'anywhere',
});

export function ProfilePage(handle: Handle<ProfilePageProps>) {
  return () => {
    let { csrfToken, email, displayName, error, message } = handle.props;
    let trimmedDisplayName = displayName?.trim() || null;

    return (
      <AppShell
        csrfToken={csrfToken}
        displayName={displayName}
        email={email}
        section="profile"
        title="Profile"
        description="Manage your My Remix App display name and account identity."
      >
        <header mix={headerStyle}>
          <h1 mix={headingStyle}>Profile</h1>
          <p mix={introStyle}>This is the identity the app uses to greet you.</p>
        </header>
        {error ? (
          <p role="alert" mix={errorStyle}>
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" mix={statusStyle}>
            {message}
          </p>
        ) : null}
        <section aria-labelledby="identity-heading" mix={cardStyle}>
          <h2 id="identity-heading" mix={cardHeadingStyle}>
            Identity
          </h2>
          <dl mix={listStyle}>
            <div>
              <dt mix={termStyle}>Display name</dt>
              <dd mix={detailStyle}>{trimmedDisplayName ?? 'Not set'}</dd>
            </div>
            <div>
              <dt mix={termStyle}>Email</dt>
              <dd mix={detailStyle}>{email}</dd>
            </div>
          </dl>
        </section>
      </AppShell>
    );
  };
}
