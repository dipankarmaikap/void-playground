import type { Handle } from 'remix/component';
import { css } from 'remix/component';
import type { Issue } from 'remix/data-schema';

import { COUNTRIES, countryName } from '../../../../data/client-billing.ts';
import { CLIENT_TEXT_LIMITS } from '../../../../data/client-text.ts';
import type { OrganizationGstRatePreset } from '../../../../data/db.ts';
import { INDIA_STATES } from '../../../../data/india-states.ts';
import type { InvoicingProfileView } from '../../../../data/organization-invoicing.ts';
import { AppShell } from '../../../../ui/app-shell.tsx';
import { Button } from '../../../../ui/button.tsx';
import { Field } from '../../../../ui/field.tsx';
import type { UserIdentity } from '../../../../ui/identity.ts';
import { Input } from '../../../../ui/input.tsx';
import { Select } from '../../../../ui/select.tsx';
import {
  formStackStyle,
  noticeErrorStyle,
  noticeSpacingStyle,
  noticeStatusStyle,
  pageHeaderStyle,
  pageHeadingStyle,
  pageIntroStyle,
} from '../../../../ui/page-styles.ts';
import { colors, radius, shadow } from '../../../../ui/theme.ts';
import { APP_NAME } from '../../../../config.ts';
import { routes } from '../../../../routes.ts';
import type { InvoicingFormValues } from './form-values.ts';

export interface InvoicingPageProps {
  csrfToken: string;
  identity: UserIdentity;
  organizationName: string;
  view: InvoicingProfileView;
  values: InvoicingFormValues;
  issues?: Issue[];
  /** A 400 re-render echoes every field exactly as submitted, before canonicalization. */
  submitted?: boolean;
  message?: string;
  presets: OrganizationGstRatePreset[];
  /** A rejected preset submission is echoed back so the User can fix it without retyping. */
  presetRate?: string;
  presetError?: string;
  /** The inline preset row that was submitted, so only that row shows the attempted rate. */
  presetErrorId?: string;
}

const cardStyle = css({
  padding: '1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  boxShadow: shadow.card,
});

const cardGapStyle = css({
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

const missingStyle = css({
  margin: '0.5rem 0 0',
  paddingLeft: '1.25rem',
  color: colors.muted,
  fontSize: '0.875rem',
});

const addressGroupStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
});

const checkboxStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  color: colors.text,
  fontSize: '0.875rem',
  fontWeight: 600,
});

const presetListStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginBottom: '1rem',
});

const presetRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
});

const presetRowFormStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
});

const presetRateInputStyle = css({
  width: '7rem',
});

export function InvoicingPage(handle: Handle<InvoicingPageProps>) {
  return () => {
    let {
      csrfToken,
      identity,
      organizationName,
      view,
      values,
      issues = [],
      submitted = false,
      message,
      presets,
      presetRate = '',
      presetError,
      presetErrorId,
    } = handle.props;
    let legalNameIssue = issueFor(issues, 'legal_name');
    let line1Issue = issueFor(issues, 'address_line1');
    let localityIssue = issueFor(issues, 'address_locality');
    let regionIssue = issueFor(issues, 'address_region');
    let postalCodeIssue = issueFor(issues, 'address_postal_code');
    let countryIssue = issueFor(issues, 'address_country');
    let emailIssue = issueFor(issues, 'billing_email');
    let phoneIssue = issueFor(issues, 'billing_phone');
    let panIssue = issueFor(issues, 'pan');
    let gstinIssue = issueFor(issues, 'gstin');
    let gstStateIssue = issueFor(issues, 'gst_state_code');

    return (
      <AppShell
        csrfToken={csrfToken}
        identity={identity}
        organizationName={organizationName}
        section="invoicing"
        title="Invoicing"
        description={`Manage how ${APP_NAME} presents your Organization on invoices.`}
      >
        <header mix={pageHeaderStyle}>
          <h1 mix={pageHeadingStyle}>Invoicing</h1>
          <p mix={pageIntroStyle}>
            Manage your Organization&rsquo;s seller details and billing contact channels.
          </p>
        </header>

        <section aria-labelledby="issue-readiness-heading" mix={cardStyle}>
          <h2 id="issue-readiness-heading" mix={cardHeadingStyle}>
            Issue readiness
          </h2>
          <p role="status" mix={noticeSpacingStyle}>
            {view.issueReady ? 'Ready to issue invoices' : 'Not ready to issue invoices'}
          </p>
          {view.issueReady ? null : (
            <>
              <p mix={detailStyle}>Complete these seller details before issuing an invoice:</p>
              <ul mix={missingStyle}>
                {view.missingRequirements.map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ul>
            </>
          )}
          <dl mix={listStyle}>
            <div>
              <dt mix={termStyle}>Seller legal name</dt>
              <dd mix={detailStyle}>{view.legalName}</dd>
            </div>
            <div>
              <dt mix={termStyle}>Legal seller name override</dt>
              <dd mix={detailStyle}>{view.explicitLegalName?.trim() || 'Not set'}</dd>
            </div>
          </dl>
        </section>

        <form
          method="post"
          action={routes.app.settings.invoicing.action.href()}
          mix={formStackStyle}
        >
          <input type="hidden" name="_csrf" value={csrfToken} />
          {issues.length > 0 ? (
            <p role="alert" mix={[noticeErrorStyle, noticeSpacingStyle]}>
              Please correct the fields below.
            </p>
          ) : null}
          {message ? (
            <p role="status" mix={[noticeStatusStyle, noticeSpacingStyle]}>
              {message}
            </p>
          ) : null}

          <section aria-labelledby="seller-profile-heading" mix={[cardStyle, cardGapStyle]}>
            <h2 id="seller-profile-heading" mix={cardHeadingStyle}>
              Seller profile
            </h2>
            <Field
              label="Legal seller name"
              hint="Optional. Leave blank to use the Organization name on invoices."
              error={legalNameIssue?.message}
            >
              <Input
                name="legal_name"
                autoComplete="organization"
                maxLength={CLIENT_TEXT_LIMITS.legal_name}
                defaultValue={values.legal_name}
                aria-invalid={legalNameIssue ? true : undefined}
                variant={legalNameIssue ? 'error' : 'default'}
              />
            </Field>

            <div mix={addressGroupStyle}>
              <Field
                label="Business address line 1"
                hint="Optional. If you enter any address field, line 1 and country are required."
                error={line1Issue?.message}
              >
                <Input
                  name="address_line1"
                  autoComplete="address-line1"
                  maxLength={CLIENT_TEXT_LIMITS.billing_line1}
                  defaultValue={values.address_line1}
                  aria-invalid={line1Issue ? true : undefined}
                  variant={line1Issue ? 'error' : 'default'}
                />
              </Field>
              <Field
                label="Locality or city"
                hint="Optional."
                error={localityIssue?.message}
              >
                <Input
                  name="address_locality"
                  autoComplete="address-level2"
                  maxLength={CLIENT_TEXT_LIMITS.billing_locality}
                  defaultValue={values.address_locality}
                  aria-invalid={localityIssue ? true : undefined}
                  variant={localityIssue ? 'error' : 'default'}
                />
              </Field>
              <Field
                label="State or region"
                hint="Optional. Kept as free text for different countries."
                error={regionIssue?.message}
              >
                <Input
                  name="address_region"
                  autoComplete="address-level1"
                  maxLength={CLIENT_TEXT_LIMITS.billing_region}
                  defaultValue={values.address_region}
                  aria-invalid={regionIssue ? true : undefined}
                  variant={regionIssue ? 'error' : 'default'}
                />
              </Field>
              <Field label="Postal code" hint="Optional." error={postalCodeIssue?.message}>
                <Input
                  name="address_postal_code"
                  autoComplete="postal-code"
                  maxLength={CLIENT_TEXT_LIMITS.billing_postal_code}
                  defaultValue={values.address_postal_code}
                  aria-invalid={postalCodeIssue ? true : undefined}
                  variant={postalCodeIssue ? 'error' : 'default'}
                />
              </Field>
              <Field
                label="Business country"
                hint="Required when you enter a business address. Known names and codes are suggestions."
                error={countryIssue?.message}
              >
                <Input
                  name="address_country"
                  autoComplete="country-name"
                  list="invoicing-countries"
                  maxLength={CLIENT_TEXT_LIMITS.billing_country}
                  defaultValue={
                    submitted || countryIssue
                      ? values.address_country
                      : countryName(values.address_country)
                  }
                  aria-invalid={countryIssue ? true : undefined}
                  variant={countryIssue ? 'error' : 'default'}
                />
                <datalist id="invoicing-countries">
                  {COUNTRIES.map((option) => (
                    <option key={option.code} value={option.name} />
                  ))}
                </datalist>
              </Field>
            </div>

            <Field label="Billing email" hint="Optional." error={emailIssue?.message}>
              <Input
                name="billing_email"
                type="email"
                autoComplete="email"
                maxLength={CLIENT_TEXT_LIMITS.email}
                defaultValue={values.billing_email}
                aria-invalid={emailIssue ? true : undefined}
                variant={emailIssue ? 'error' : 'default'}
              />
            </Field>
            <Field label="Billing phone" hint="Optional." error={phoneIssue?.message}>
              <Input
                name="billing_phone"
                type="tel"
                autoComplete="tel"
                maxLength={CLIENT_TEXT_LIMITS.phone}
                defaultValue={values.billing_phone}
                aria-invalid={phoneIssue ? true : undefined}
                variant={phoneIssue ? 'error' : 'default'}
              />
            </Field>

          </section>

          <section aria-labelledby="tax-registration-heading" mix={[cardStyle, cardGapStyle]}>
            <h2 id="tax-registration-heading" mix={cardHeadingStyle}>
              Tax registration
            </h2>
            <Field
              label="PAN (India)"
              hint="Optional. 10-character Permanent Account Number, saved in uppercase."
              error={panIssue?.message}
            >
              <Input
                name="pan"
                maxLength={10}
                autoComplete="off"
                defaultValue={values.pan}
                aria-invalid={panIssue ? true : undefined}
                variant={panIssue ? 'error' : 'default'}
              />
            </Field>

            <label mix={checkboxStyle}>
              <input
                type="checkbox"
                name="gst_registered"
                value="on"
                defaultChecked={Boolean(values.gst_registered)}
              />
              <span>GST registration is enabled for this Organization</span>
            </label>

            <Field
              label="GSTIN (India)"
              hint="Required when GST registration is enabled. 15 characters; no registry lookup is performed."
              error={gstinIssue?.message}
            >
              <Input
                name="gstin"
                maxLength={15}
                autoComplete="off"
                defaultValue={values.gstin}
                aria-invalid={gstinIssue ? true : undefined}
                variant={gstinIssue ? 'error' : 'default'}
              />
            </Field>
            <Field
              label="GST State or UT (India)"
              hint="Required when GST registration is enabled; its code must match the first two GSTIN digits."
              error={gstStateIssue?.message}
            >
              <Select
                name="gst_state_code"
                aria-invalid={gstStateIssue ? true : undefined}
                variant={gstStateIssue ? 'error' : 'default'}
              >
                <option value="" selected={!values.gst_state_code}>
                  Not recorded
                </option>
                {INDIA_STATES.map((state) => (
                  <option
                    key={state.code}
                    value={state.code}
                    selected={values.gst_state_code === state.code}
                  >
                    {state.name} ({state.code})
                  </option>
                ))}
              </Select>
            </Field>

          </section>

          <div>
            <Button type="submit">Save invoicing settings</Button>
          </div>
        </form>

        <section aria-labelledby="gst-presets-heading" mix={[cardStyle, cardGapStyle]}>
          <h2 id="gst-presets-heading" mix={cardHeadingStyle}>
            GST rate presets
          </h2>
          <p mix={detailStyle}>
            Editable rate presets available on this Organization&rsquo;s invoice service lines.
          </p>
          {presetError ? (
            <p id="preset-error" role="alert" mix={[noticeErrorStyle, noticeSpacingStyle]}>
              {presetError}
            </p>
          ) : null}
          <div mix={presetListStyle}>
            {presets.map((preset) => (
              <div key={preset.id} mix={presetRowStyle}>
                <form
                  method="post"
                  action={routes.app.settings.invoicing.action.href()}
                  mix={presetRowFormStyle}
                >
                  <input type="hidden" name="_csrf" value={csrfToken} />
                  <input type="hidden" name="_form" value="preset_update" />
                  <input type="hidden" name="preset_id" value={preset.id} />
                  <Input
                    name="rate"
                    aria-label={`GST rate preset ${preset.rate}%`}
                    aria-invalid={presetErrorId === preset.id ? true : undefined}
                    aria-describedby={presetErrorId === preset.id ? 'preset-error' : undefined}
                    mix={presetRateInputStyle}
                    variant={presetErrorId === preset.id ? 'error' : 'default'}
                    defaultValue={presetErrorId === preset.id ? presetRate : preset.rate}
                  />
                  <Button type="submit" variant="secondary">
                    Save
                  </Button>
                </form>
                <form method="post" action={routes.app.settings.invoicing.action.href()}>
                  <input type="hidden" name="_csrf" value={csrfToken} />
                  <input type="hidden" name="_form" value="preset_remove" />
                  <input type="hidden" name="preset_id" value={preset.id} />
                  <Button type="submit" variant="danger">
                    Remove
                  </Button>
                </form>
              </div>
            ))}
          </div>
          <form
            method="post"
            action={routes.app.settings.invoicing.action.href()}
            mix={formStackStyle}
          >
            <input type="hidden" name="_csrf" value={csrfToken} />
            <input type="hidden" name="_form" value="preset_add" />
            <Field
              label="Add a GST rate preset"
              hint="A non-negative decimal percentage from 0 to 100, such as 12.5."
            >
              <Input
                name="rate"
                defaultValue={presetRate}
                aria-invalid={presetError ? true : undefined}
                variant={presetError ? 'error' : 'default'}
              />
            </Field>
            <Button type="submit" variant="secondary">
              Add rate
            </Button>
          </form>
        </section>
      </AppShell>
    );
  };
}

function issueFor(issues: readonly Issue[], field: string): Issue | undefined {
  return issues.find((issue) => issue.path?.[0] === field);
}
