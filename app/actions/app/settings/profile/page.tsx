import type { Handle } from 'remix/component';

import { AppShell } from '../../../../ui/app-shell.tsx';
import { Button } from '../../../../ui/button.tsx';
import { Field } from '../../../../ui/field.tsx';
import type { UserIdentity } from '../../../../ui/identity.ts';
import { Input } from '../../../../ui/input.tsx';
import {
  formStackStartStyle,
  noticeErrorStyle,
  noticeStatusStyle,
  pageHeaderStyle,
  pageHeadingStyle,
  pageIntroStyle,
} from '../../../../ui/page-styles.ts';
import { formFieldAttributes } from '../../../../ui/public/form-field.ts';
import { APP_NAME } from '../../../../config.ts';
import { routes } from '../../../../routes.ts';
import {
  settingsCardDetailStyle,
  settingsCardHeadingStyle,
  settingsCardListStyle,
  settingsCardStackStyle,
  settingsCardStyle,
  settingsCardTermStyle,
} from '../ui/card-style.ts';
import { displayNameFormFields, organizationNameFormFields } from './public/schema.ts';

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
        <section aria-labelledby="organization-heading" mix={settingsCardStyle}>
          <h2 id="organization-heading" mix={settingsCardHeadingStyle}>
            Organization
          </h2>
          <dl mix={settingsCardListStyle}>
            <div>
              <dt mix={settingsCardTermStyle}>Organization name</dt>
              <dd mix={settingsCardDetailStyle}>{organizationName}</dd>
            </div>
          </dl>
          {organizationError ? (
            <p
              id="organization-name-error"
              role="alert"
              data-spacing="true"
              mix={noticeErrorStyle}
            >
              {organizationError}
            </p>
          ) : null}
          {organizationMessage ? (
            <p role="status" data-spacing="true" mix={noticeStatusStyle}>
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
                aria-invalid={organizationError ? 'true' : undefined}
                aria-describedby={organizationError ? 'organization-name-error' : undefined}
                defaultValue={organizationNameValue ?? organizationName}
                {...formFieldAttributes(organizationNameFormFields.organization_name)}
              />
            </Field>
            <Button type="submit">Save Organization name</Button>
          </form>
        </section>
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
        <section aria-labelledby="identity-heading" mix={settingsCardStyle}>
          <h2 id="identity-heading" mix={settingsCardHeadingStyle}>
            Identity
          </h2>
          <dl mix={settingsCardListStyle}>
            <div>
              <dt mix={settingsCardTermStyle}>Display name</dt>
              <dd mix={settingsCardDetailStyle}>{trimmedDisplayName ?? 'Not set'}</dd>
            </div>
            <div>
              <dt mix={settingsCardTermStyle}>Email</dt>
              <dd mix={settingsCardDetailStyle}>{identity.email}</dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="edit-display-name-heading" mix={[settingsCardStyle, settingsCardStackStyle]}>
          <h2 id="edit-display-name-heading" mix={settingsCardHeadingStyle}>
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
                defaultValue={formValue}
                {...formFieldAttributes(displayNameFormFields.display_name)}
              />
            </Field>
            <Button type="submit">Save profile</Button>
          </form>
        </section>
      </AppShell>
    );
  };
}
