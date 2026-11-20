import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { formatKolkataTimestamp } from '../../../../data/dates.ts';
import { routes } from '../../../../routes.ts';
import { AppShell } from '../../../../ui/app-shell.tsx';
import { Button } from '../../../../ui/button.tsx';
import { Icon } from '../../../../ui/icon.tsx';
import type { UserIdentity } from '../../../../ui/identity.ts';
import {
  noticeErrorStyle,
  noticeStatusStyle,
  pageHeaderStyle,
  pageHeadingStyle,
  pageIntroStyle,
} from '../../../../ui/page-styles.ts';
import { colors, radius, shadow } from '../../../../ui/theme.ts';

export interface SessionView {
  id: string;
  current: boolean;
  browser: string;
  ip: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface SessionsPageProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName?: string;
  sessions: SessionView[];
  error?: string;
  message?: string;
}

const listStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
});

const rowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '1rem',
  padding: '1rem 1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  boxShadow: shadow.card,
  '&[data-current="true"]': {
    borderColor: colors.accent,
    background: colors.accentSoft,
  },
});

const rowMainStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.375rem',
  minWidth: 0,
});

const browserLineStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.9375rem',
  fontWeight: 700,
  overflowWrap: 'anywhere',
});

const currentBadgeStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.125rem 0.5rem',
  borderRadius: '999px',
  background: colors.accent,
  color: colors.onPrimary,
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.02em',
});

const metaListStyle = css({
  margin: 0,
  display: 'grid',
  gap: '0.125rem',
  color: colors.muted,
  fontSize: '0.8125rem',
  lineHeight: 1.5,
});

const metaTermStyle = css({
  fontWeight: 600,
  marginRight: '0.25rem',
  display: 'inline',
});

const metaDetailStyle = css({
  margin: 0,
  display: 'inline',
});

const revokeFormStyle = css({
  display: 'inline-flex',
});

const dangerZoneStyle = css({
  marginTop: '1.75rem',
  padding: '1rem 1.25rem',
  border: `1px solid ${colors.danger}`,
  borderRadius: radius.lg,
  background: colors.surface,
});

const dangerSummaryStyle = css({
  cursor: 'pointer',
  color: colors.danger,
  fontSize: '0.9375rem',
  fontWeight: 700,
  listStyle: 'none',
  '&::-webkit-details-marker': {
    display: 'none',
  },
});

const dangerBodyStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  marginTop: '0.75rem',
});

const dangerCopyStyle = css({
  margin: 0,
  color: colors.muted,
  fontSize: '0.875rem',
  lineHeight: 1.5,
});

export function SessionsPage(handle: Handle<SessionsPageProps>) {
  return () => {
    let { csrfToken, identity, organizationName, sessions, error, message } = handle.props;
    let action = routes.app.settings.sessions.action.href();
    let hasOtherSessions = sessions.some((session) => !session.current);

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        organizationName={organizationName}
        section="sessions"
        title="Sessions"
        description="Review and revoke the browsers signed in to your account."
      >
        <header mix={pageHeaderStyle}>
          <h1 mix={pageHeadingStyle}>Sessions</h1>
          <p mix={pageIntroStyle}>
            These are the browsers currently signed in to your account. Revoke one you no longer use.
          </p>
        </header>
        {error ? (
          <p role="alert" data-spacing="true" mix={noticeErrorStyle}>
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" data-spacing="true" mix={noticeStatusStyle}>
            {message}
          </p>
        ) : null}
        <ul mix={listStyle}>
          {sessions.map((session) => (
            <li
              key={session.id}
              data-current={session.current ? 'true' : undefined}
              mix={rowStyle}
            >
              <div mix={rowMainStyle}>
                <div mix={browserLineStyle}>
                  <Icon name="monitor" />
                  <span>{session.browser}</span>
                  {session.current ? <span mix={currentBadgeStyle}>This session</span> : null}
                </div>
                <dl mix={metaListStyle}>
                  <div>
                    <dt mix={metaTermStyle}>IP</dt>
                    <dd mix={metaDetailStyle}>{session.ip}</dd>
                  </div>
                  <div>
                    <dt mix={metaTermStyle}>Created</dt>
                    <dd mix={metaDetailStyle}>
                      <time dateTime={new Date(session.createdAt).toISOString()}>
                        {formatKolkataTimestamp(session.createdAt)} IST
                      </time>
                    </dd>
                  </div>
                  <div>
                    <dt mix={metaTermStyle}>Last active</dt>
                    <dd mix={metaDetailStyle}>
                      <time dateTime={new Date(session.lastActiveAt).toISOString()}>
                        {formatKolkataTimestamp(session.lastActiveAt)} IST
                      </time>
                    </dd>
                  </div>
                </dl>
              </div>
              {session.current ? null : (
                <form method="post" action={action} mix={revokeFormStyle}>
                  <input type="hidden" name="_csrf" value={csrfToken} />
                  <input type="hidden" name="action" value="revoke" />
                  <input type="hidden" name="session_id" value={session.id} />
                  <Button variant="danger">Revoke</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {hasOtherSessions ? (
          <details mix={dangerZoneStyle}>
            <summary mix={dangerSummaryStyle}>Revoke all other sessions</summary>
            <div mix={dangerBodyStyle}>
              <p mix={dangerCopyStyle}>
                This ends every Session except this one. You will stay signed in in this browser.
              </p>
              <form method="post" action={action}>
                <input type="hidden" name="_csrf" value={csrfToken} />
                <input type="hidden" name="action" value="revoke_others" />
                <Button variant="danger">Revoke all other sessions</Button>
              </form>
            </div>
          </details>
        ) : null}
      </AppShell>
    );
  };
}
