import type { Handle } from 'remix/component';
import { css } from 'remix/component';
import type { Issue } from 'remix/data-schema';

import { COUNTRIES, CURRENCIES, countryName } from '../../../../data/client-billing.ts';
import type { OrganizationGstRatePreset } from '../../../../data/db.ts';
import { INDIA_STATES } from '../../../../data/india-states.ts';
import {
  PAYMENT_TERMS,
  PAYMENT_TERM_LABELS,
} from '../../../../data/organization/invoicing.ts';
import type { InvoicingProfileView } from '../../../../data/organization/invoicing.ts';
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
import { formFieldAttributes } from '../../../../ui/public/form-field.ts';
import { APP_NAME } from '../../../../config.ts';
import { routes } from '../../../../routes.ts';
import type { InvoicingFormValues } from './form-values.ts';
import { invoicingFormFields, presetFormFields } from './public/schema.ts';

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

const imagePreviewStyle = css({
  display: 'block',
  maxWidth: '12rem',
  maxHeight: '5rem',
  marginBottom: '0.5rem',
  objectFit: 'contain',
});

const textAreaStyle = css({
  padding: '10px 12px',
  width: '100%',
  minHeight: '5rem',
  boxSizing: 'border-box',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  background: colors.surface,
  color: colors.text,
  fontFamily: 'inherit',
  fontSize: '0.9375rem',
  resize: 'vertical',
  '&:focus': {
    outline: `2px solid ${colors.accent}`,
    outlineOffset: '1px',
    borderColor: colors.accent,
  },
  '&[aria-invalid="true"]': {
    borderColor: colors.danger,
  },
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
    let currencyIssue = issueFor(issues, 'default_currency');
    let paymentTermIssue = issueFor(issues, 'payment_term');
    let customTermsIssue = issueFor(issues, 'custom_payment_terms');
    let instructionsIssue = issueFor(issues, 'payment_instructions');
    let notesIssue = issueFor(issues, 'customer_notes');
    let invoicePrefixIssue = issueFor(issues, 'invoice_prefix');
    let invoiceNumberIssue = issueFor(issues, 'invoice_starting_number');
    let creditNotePrefixIssue = issueFor(issues, 'credit_note_prefix');
    let creditNoteNumberIssue = issueFor(issues, 'credit_note_starting_number');
    let logoIssue = issueFor(issues, 'logo');
    let signatureIssue = issueFor(issues, 'signature_image');
    let signatoryNameIssue = issueFor(issues, 'signatory_name');
    let signatoryDesignationIssue = issueFor(issues, 'signatory_designation');

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
            <p role="alert" data-spacing="true" mix={noticeErrorStyle}>
              Please correct the fields below.
            </p>
          ) : null}
          {message ? (
            <p role="status" data-spacing="true" mix={noticeStatusStyle}>
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
                defaultValue={values.legal_name}
                variant={legalNameIssue ? 'error' : 'default'}
                {...formFieldAttributes(invoicingFormFields.legal_name, legalNameIssue)}
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
                  defaultValue={values.address_line1}
                  variant={line1Issue ? 'error' : 'default'}
                  {...formFieldAttributes(invoicingFormFields.address_line1, line1Issue)}
                />
              </Field>
              <Field
                label="Locality or city"
                hint="Optional."
                error={localityIssue?.message}
              >
                <Input
                  name="address_locality"
                  defaultValue={values.address_locality}
                  variant={localityIssue ? 'error' : 'default'}
                  {...formFieldAttributes(invoicingFormFields.address_locality, localityIssue)}
                />
              </Field>
              <Field
                label="State or region"
                hint="Optional. Kept as free text for different countries."
                error={regionIssue?.message}
              >
                <Input
                  name="address_region"
                  defaultValue={values.address_region}
                  variant={regionIssue ? 'error' : 'default'}
                  {...formFieldAttributes(invoicingFormFields.address_region, regionIssue)}
                />
              </Field>
              <Field label="Postal code" hint="Optional." error={postalCodeIssue?.message}>
                <Input
                  name="address_postal_code"
                  defaultValue={values.address_postal_code}
                  variant={postalCodeIssue ? 'error' : 'default'}
                  {...formFieldAttributes(
                    invoicingFormFields.address_postal_code,
                    postalCodeIssue,
                  )}
                />
              </Field>
              <Field
                label="Business country"
                hint="Required when you enter a business address. Known names and codes are suggestions."
                error={countryIssue?.message}
              >
                <Input
                  name="address_country"
                  list="invoicing-countries"
                  defaultValue={
                    submitted || countryIssue
                      ? values.address_country
                      : countryName(values.address_country)
                  }
                  variant={countryIssue ? 'error' : 'default'}
                  {...formFieldAttributes(invoicingFormFields.address_country, countryIssue)}
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
                defaultValue={values.billing_email}
                variant={emailIssue ? 'error' : 'default'}
                {...formFieldAttributes(invoicingFormFields.billing_email, emailIssue)}
              />
            </Field>
            <Field label="Billing phone" hint="Optional." error={phoneIssue?.message}>
              <Input
                name="billing_phone"
                defaultValue={values.billing_phone}
                variant={phoneIssue ? 'error' : 'default'}
                {...formFieldAttributes(invoicingFormFields.billing_phone, phoneIssue)}
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
                defaultValue={values.pan}
                variant={panIssue ? 'error' : 'default'}
                {...formFieldAttributes(invoicingFormFields.pan, panIssue)}
              />
            </Field>

            <label mix={checkboxStyle}>
              <input
                type="checkbox"
                name="gst_registered"
                value="on"
                defaultChecked={Boolean(values.gst_registered)}
                {...formFieldAttributes(invoicingFormFields.gst_registered)}
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
                defaultValue={values.gstin}
                variant={gstinIssue ? 'error' : 'default'}
                {...formFieldAttributes(invoicingFormFields.gstin, gstinIssue)}
              />
            </Field>
            <Field
              label="GST State or UT (India)"
              hint="Required when GST registration is enabled; its code must match the first two GSTIN digits."
              error={gstStateIssue?.message}
            >
              <Select
                name="gst_state_code"
                variant={gstStateIssue ? 'error' : 'default'}
                {...formFieldAttributes(invoicingFormFields.gst_state_code, gstStateIssue)}
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

          <section aria-labelledby="invoice-defaults-heading" mix={[cardStyle, cardGapStyle]}>
            <h2 id="invoice-defaults-heading" mix={cardHeadingStyle}>
              Invoice defaults
            </h2>
            <p mix={detailStyle}>
              These values prefill new invoice drafts for this Organization&rsquo;s Clients.
            </p>
            <Field
              label="Default currency"
              hint="A three-letter ISO 4217 code. INR is used until you choose another."
              error={currencyIssue?.message}
            >
              <Input
                name="default_currency"
                list="invoicing-currencies"
                defaultValue={values.default_currency}
                variant={currencyIssue ? 'error' : 'default'}
                {...formFieldAttributes(invoicingFormFields.default_currency, currencyIssue)}
              />
              <datalist id="invoicing-currencies">
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code} />
                ))}
              </datalist>
            </Field>

            <Field
              label="Default payment terms"
              hint="Applied when a new invoice draft is created."
              error={paymentTermIssue?.message}
            >
              <Select
                name="payment_term"
                variant={paymentTermIssue ? 'error' : 'default'}
                {...formFieldAttributes(invoicingFormFields.payment_term, paymentTermIssue)}
              >
                {values.payment_term &&
                !PAYMENT_TERMS.some((term) => term === values.payment_term) ? (
                  <option value={values.payment_term} selected>
                    {values.payment_term}
                  </option>
                ) : null}
                {PAYMENT_TERMS.map((term) => (
                  <option key={term} value={term} selected={values.payment_term === term}>
                    {PAYMENT_TERM_LABELS[term]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Custom payment terms"
              hint="Optional description used when the payment term is Custom."
              error={customTermsIssue?.message}
            >
              <textarea
                name="custom_payment_terms"
                mix={textAreaStyle}
                defaultValue={values.custom_payment_terms}
                {...formFieldAttributes(
                  invoicingFormFields.custom_payment_terms,
                  customTermsIssue,
                )}
              />
            </Field>

            <Field
              label="Payment instructions"
              hint="Optional and visible to Clients on invoices, for example bank or UPI details."
              error={instructionsIssue?.message}
            >
              <textarea
                name="payment_instructions"
                mix={textAreaStyle}
                defaultValue={values.payment_instructions}
                {...formFieldAttributes(
                  invoicingFormFields.payment_instructions,
                  instructionsIssue,
                )}
              />
            </Field>

            <Field
              label="Customer notes"
              hint="Optional note visible to Clients on invoices."
              error={notesIssue?.message}
            >
              <textarea
                name="customer_notes"
                mix={textAreaStyle}
                defaultValue={values.customer_notes}
                {...formFieldAttributes(invoicingFormFields.customer_notes, notesIssue)}
              />
            </Field>
          </section>

          <section aria-labelledby="numbering-heading" mix={[cardStyle, cardGapStyle]}>
            <h2 id="numbering-heading" mix={cardHeadingStyle}>
              Document numbering
            </h2>
            <p mix={detailStyle}>
              Prefixes and starting sequence floors for invoices and credit notes. Numbers are
              allocated later, when documents are issued.
            </p>
            <Field
              label="Invoice number prefix"
              hint="1 to 12 uppercase letters, digits, hyphens, or underscores; no slashes."
              error={invoicePrefixIssue?.message}
            >
              <Input
                name="invoice_prefix"
                defaultValue={values.invoice_prefix}
                variant={invoicePrefixIssue ? 'error' : 'default'}
                {...formFieldAttributes(invoicingFormFields.invoice_prefix, invoicePrefixIssue)}
              />
            </Field>
            <Field
              label="Invoice starting sequence"
              hint="The first number available in this series."
              error={invoiceNumberIssue?.message}
            >
              <Input
                name="invoice_starting_number"
                inputMode="numeric"
                defaultValue={values.invoice_starting_number}
                variant={invoiceNumberIssue ? 'error' : 'default'}
                {...formFieldAttributes(
                  invoicingFormFields.invoice_starting_number,
                  invoiceNumberIssue,
                )}
              />
            </Field>
            <Field
              label="Credit-note number prefix"
              hint="Must be different from the invoice prefix."
              error={creditNotePrefixIssue?.message}
            >
              <Input
                name="credit_note_prefix"
                defaultValue={values.credit_note_prefix}
                variant={creditNotePrefixIssue ? 'error' : 'default'}
                {...formFieldAttributes(
                  invoicingFormFields.credit_note_prefix,
                  creditNotePrefixIssue,
                )}
              />
            </Field>
            <Field
              label="Credit-note starting sequence"
              hint="The first number available in this series."
              error={creditNoteNumberIssue?.message}
            >
              <Input
                name="credit_note_starting_number"
                inputMode="numeric"
                defaultValue={values.credit_note_starting_number}
                variant={creditNoteNumberIssue ? 'error' : 'default'}
                {...formFieldAttributes(
                  invoicingFormFields.credit_note_starting_number,
                  creditNoteNumberIssue,
                )}
              />
            </Field>
          </section>

          <section aria-labelledby="branding-heading" mix={[cardStyle, cardGapStyle]}>
            <h2 id="branding-heading" mix={cardHeadingStyle}>
              Logo and authorized signature
            </h2>
            <p mix={detailStyle}>
              Optional PNG, JPEG, or WebP data URLs up to 128 KB each. They appear on issued
              invoices and credit notes; leave the image field blank to keep the saved image.
            </p>

            {view.logo_data_url ? (
              <img src={view.logo_data_url} alt="Organization logo" mix={imagePreviewStyle} />
            ) : null}
            <Field
              label="Organization logo"
              hint="Paste a small image data URL to add or replace the logo."
              error={logoIssue?.message}
            >
              <Input
                name="logo"
                defaultValue={values.logo}
                variant={logoIssue ? 'error' : 'default'}
                {...formFieldAttributes(invoicingFormFields.logo, logoIssue)}
              />
            </Field>
            <label mix={checkboxStyle}>
              <input
                type="checkbox"
                name="remove_logo"
                value="on"
                defaultChecked={Boolean(values.remove_logo)}
                {...formFieldAttributes(invoicingFormFields.remove_logo)}
              />
              <span>Remove the saved logo</span>
            </label>

            {view.signature_data_url ? (
              <img
                src={view.signature_data_url}
                alt="Authorized signature"
                mix={imagePreviewStyle}
              />
            ) : null}
            <Field
              label="Authorized signature"
              hint="Paste a small image data URL to add or replace the signature image."
              error={signatureIssue?.message}
            >
              <Input
                name="signature_image"
                defaultValue={values.signature_image}
                variant={signatureIssue ? 'error' : 'default'}
                {...formFieldAttributes(invoicingFormFields.signature_image, signatureIssue)}
              />
            </Field>
            <label mix={checkboxStyle}>
              <input
                type="checkbox"
                name="remove_signature_image"
                value="on"
                defaultChecked={Boolean(values.remove_signature_image)}
                {...formFieldAttributes(invoicingFormFields.remove_signature_image)}
              />
              <span>Remove the saved signature image</span>
            </label>

            <Field
              label="Signatory name"
              hint="Optional. The person authorized to sign on behalf of the Organization."
              error={signatoryNameIssue?.message}
            >
              <Input
                name="signatory_name"
                defaultValue={values.signatory_name}
                variant={signatoryNameIssue ? 'error' : 'default'}
                {...formFieldAttributes(invoicingFormFields.signatory_name, signatoryNameIssue)}
              />
            </Field>
            <Field
              label="Signatory designation"
              hint="Optional, for example Director or Authorised Signatory."
              error={signatoryDesignationIssue?.message}
            >
              <Input
                name="signatory_designation"
                defaultValue={values.signatory_designation}
                variant={signatoryDesignationIssue ? 'error' : 'default'}
                {...formFieldAttributes(
                  invoicingFormFields.signatory_designation,
                  signatoryDesignationIssue,
                )}
              />
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
            <p id="preset-error" role="alert" data-spacing="true" mix={noticeErrorStyle}>
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
                    aria-describedby={presetErrorId === preset.id ? 'preset-error' : undefined}
                    mix={presetRateInputStyle}
                    variant={presetErrorId === preset.id ? 'error' : 'default'}
                    defaultValue={presetErrorId === preset.id ? presetRate : preset.rate}
                    {...formFieldAttributes(
                      presetFormFields.rate,
                      presetErrorId === preset.id ? presetError : undefined,
                    )}
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
                variant={presetError ? 'error' : 'default'}
                {...formFieldAttributes(presetFormFields.rate, presetError)}
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
