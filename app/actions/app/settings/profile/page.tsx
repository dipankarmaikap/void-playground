import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { AppShell } from '../../../../ui/app-shell.tsx';
import { Button } from '../../../../ui/button.tsx';
import { Field } from '../../../../ui/field.tsx';
import type { UserIdentity } from '../../../../ui/identity.ts';
import { Input } from '../../../../ui/input.tsx';
import {
  formStackStartStyle,
  noticeErrorStyle,
  noticeSpacingStyle,
  noticeStatusStyle,
  pageHeaderStyle,
  pageHeadingStyle,
  pageIntroStyle,
} from '../../../../ui/page-styles.ts';
import { colors, radius, shadow } from '../../../../ui/theme.ts';
import { APP_NAME, DISPLAY_NAME_MAX_LENGTH } from '../../../../config.ts';
import { routes } from '../../../../routes.ts';

export interface ProfilePageProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName: string;
  organizationNameValue?: string;
  organizationError?: string;
  organizationMessage?: string;
  displayNameValue?: string;
  error?: string;
  message?: string;
}

const cardStyle = css({
  padding: '1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  boxShadow: shadow.card,
});

const editCardStyle = css({
  marginTop: '1rem',
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
    let {
      csrfToken,
      identity,
      organizationName,
      organizationNameValue,
      organizationError,
      organizationMessage,
      displayNameValue,
      error,
      message,
    } = handle.props;
    let trimmedDisplayName = identity.displayName?.trim() || null;
    let formValue = displayNameValue ?? trimmedDisplayName ?? '';

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        organizationName={organizationName}
        section="profile"
        title="Profile"
        description={`Manage your ${APP_NAME} Organization and personal display name.`}
      >
        <header mix={pageHeaderStyle}>
          <h1 mix={pageHeadingStyle}>Profile</h1>
          <p mix={pageIntroStyle}>
            Manage your Organization identity separately from your personal display name.
          </p>
        </header>
        <section aria-labelledby="organization-heading" mix={cardStyle}>
          <h2 id="organization-heading" mix={cardHeadingStyle}>
            Organization
          </h2>
          <dl mix={listStyle}>
            <div>
              <dt mix={termStyle}>Organization name</dt>
              <dd mix={detailStyle}>{organizationName}</dd>
            </div>
          </dl>
          {organizationError ? (
            <p id="organization-name-error" role="alert" mix={[noticeErrorStyle, noticeSpacingStyle]}>
              {organizationError}
            </p>
          ) : null}
          {organizationMessage ? (
            <p role="status" mix={[noticeStatusStyle, noticeSpacingStyle]}>
              {organizationMessage}
            </p>
          ) : null}
          <form
            method="post"
            action={routes.app.settings.profile.action.href()}
            mix={formStackStartStyle}
          >
            <input type="hidden" name="_csrf" value={csrfToken} />
            <Field label="Organization name">
              <Input
                name="organization_name"
                autoComplete="organization"
                required
                aria-invalid={organizationError ? 'true' : undefined}
                aria-describedby={organizationError ? 'organization-name-error' : undefined}
                defaultValue={organizationNameValue ?? organizationName}
              />
            </Field>
            <Button type="submit">Save Organization name</Button>
          </form>
        </section>
        {error ? (
          <p role="alert" mix={[noticeErrorStyle, noticeSpacingStyle]}>
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" mix={[noticeStatusStyle, noticeSpacingStyle]}>
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
              <dd mix={detailStyle}>{identity.email}</dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="edit-display-name-heading" mix={[cardStyle, editCardStyle]}>
          <h2 id="edit-display-name-heading" mix={cardHeadingStyle}>
            Display name
          </h2>
          <form
            method="post"
            action={routes.app.settings.profile.action.href()}
            mix={formStackStartStyle}
          >
            <input type="hidden" name="_csrf" value={csrfToken} />
            <Field label="Display name" hint="Leave blank to use your email address instead.">
              <Input
                name="display_name"
                autoComplete="nickname"
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                defaultValue={formValue}
              />
            </Field>
            <Button type="submit">Save profile</Button>
          </form>
        </section>
      </AppShell>
    );
  };
}
