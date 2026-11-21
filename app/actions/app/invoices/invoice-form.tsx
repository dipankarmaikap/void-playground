import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';
import type { Issue } from 'remix/data-schema';

import { COUNTRIES, CURRENCIES } from '../../../data/client-billing.ts';
import { PAYMENT_TERMS, PAYMENT_TERM_LABELS } from '../../../data/organization/invoicing.ts';
import { INDIA_STATES } from '../../../data/india-states.ts';
import { Button } from '../../../ui/button.tsx';
import { Field } from '../../../ui/field.tsx';
import { Input } from '../../../ui/input.tsx';
import { formFieldAttributes } from '../../../ui/public/form-field.ts';
import { colors, radius } from '../../../ui/theme.ts';
import { cardStyle } from './ui/card-style.ts';
import { RestfulForm } from '../../../ui/public/restful-form.tsx';
import type { InvoiceFormValues } from './form-values.ts';
import { InvoiceFormLines } from './invoice-form-lines.tsx';
import { invoiceDraftFormFields } from './public/schema.ts';

export interface InvoiceFormProps {
  csrfToken: string;
  action: string;
  method?: 'POST' | 'PUT';
  submitLabel: string;
  values: InvoiceFormValues;
  issues?: readonly Issue[];
  gstRatePresets: readonly string[];
  children?: RemixNode;
}

const formStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
});

const gridStyle = css({
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))',
});

const textAreaStyle = css({
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  background: colors.surface,
  color: colors.text,
  fontFamily: 'inherit',
  fontSize: '0.9375rem',
  minHeight: '5rem',
  '&[aria-invalid="true"]': { borderColor: colors.danger },
});

const formActionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
});

const errorSummaryStyle = css({
  padding: '1rem',
  border: `1px solid ${colors.danger}`,
  borderRadius: radius.md,
  background: colors.surface,
  '&:focus': {
    outline: `2px solid ${colors.danger}`,
    outlineOffset: '2px',
  },
});

const sectionHeadingStyle = css({
  margin: 0,
  fontSize: '1.0625rem',
});

const hintStyle = css({
  margin: 0,
  color: colors.muted,
  fontSize: '0.8125rem',
});

function firstIssue(issues: readonly Issue[], field: string): Issue | undefined {
  return issues.find((issue) => issue.path?.[0] === field);
}

export function InvoiceForm(handle: Handle<InvoiceFormProps>) {
  return () => {
    let {
      csrfToken,
      action,
      method = 'POST',
      submitLabel,
      values,
      issues = [],
      children,
      gstRatePresets,
    } = handle.props;
    let linesIssue = firstIssue(issues, 'lines');

    return (
      <RestfulForm method={method} action={action} mix={formStyle}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        <input type="hidden" name="client_id" value={values.client_id} />
        <input
          type="hidden"
          name="recipient_tax_state_name"
          value={values.recipient_tax_state_name}
        />
        {children}
        {issues.length > 0 ? (
          <section
            id="invoice-error-summary"
            tabIndex={-1}
            autoFocus
            aria-labelledby="invoice-error-heading"
            mix={errorSummaryStyle}
          >
            <h2 id="invoice-error-heading">Please correct the fields below.</h2>
            <ul>
              {issues.map((issue, index) => (
                <li key={index}>{issue.message}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {!gstRatePresets.length && firstIssue(issues, 'gst_mode') ? (
          <p role="alert">{firstIssue(issues, 'gst_mode')?.message}</p>
        ) : null}
        {firstIssue(issues, 'client_id') ? (
          <p role="alert">{firstIssue(issues, 'client_id')?.message}</p>
        ) : null}

        <section aria-labelledby="invoice-basics-heading" data-gap="form" mix={cardStyle}>
          <h2 id="invoice-basics-heading" mix={sectionHeadingStyle}>
            Invoice details
          </h2>
          <div mix={gridStyle}>
            <Field label="Currency" error={firstIssue(issues, 'currency')?.message}>
              <Input
                name="currency"
                list="invoice-currencies"
                defaultValue={values.currency}
                variant={firstIssue(issues, 'currency') ? 'error' : 'default'}
                {...formFieldAttributes(invoiceDraftFormFields.currency, firstIssue(issues, 'currency'))}
              />
              <datalist id="invoice-currencies">
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.name}
                  </option>
                ))}
              </datalist>
            </Field>
            <Field label="Invoice date" error={firstIssue(issues, 'invoice_date')?.message}>
              <Input
                name="invoice_date"
                defaultValue={values.invoice_date}
                variant={firstIssue(issues, 'invoice_date') ? 'error' : 'default'}
                {...formFieldAttributes(invoiceDraftFormFields.invoice_date, firstIssue(issues, 'invoice_date'))}
              />
            </Field>
            <Field label="Due date" error={firstIssue(issues, 'due_date')?.message}>
              <Input
                name="due_date"
                defaultValue={values.due_date}
                variant={firstIssue(issues, 'due_date') ? 'error' : 'default'}
                {...formFieldAttributes(invoiceDraftFormFields.due_date, firstIssue(issues, 'due_date'))}
              />
            </Field>
            <Field label="Payment term" error={firstIssue(issues, 'payment_term')?.message}>
              <select
                name="payment_term"
                {...formFieldAttributes(invoiceDraftFormFields.payment_term, firstIssue(issues, 'payment_term'))}
              >
                {PAYMENT_TERMS.map((term) => (
                  <option key={term} value={term} selected={values.payment_term === term}>
                    {PAYMENT_TERM_LABELS[term]}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Custom payment terms"
              error={firstIssue(issues, 'custom_payment_terms')?.message}
            >
              <textarea
                name="custom_payment_terms"
                mix={textAreaStyle}
                defaultValue={values.custom_payment_terms}
                {...formFieldAttributes(invoiceDraftFormFields.custom_payment_terms, firstIssue(issues, 'custom_payment_terms'))}
              />
            </Field>
          </div>
        </section>

        <section aria-labelledby="invoice-recipient-heading" data-gap="form" mix={cardStyle}>
          <h2 id="invoice-recipient-heading" mix={sectionHeadingStyle}>
            Bill to
          </h2>
          <p mix={hintStyle}>
            Prefilled from the Client. Changes here apply to this invoice only, never to the Client
            profile.
          </p>
          <div mix={gridStyle}>
            <Field
              label="Recipient legal name"
              error={firstIssue(issues, 'recipient_legal_name')?.message}
            >
              <Input
                name="recipient_legal_name"
                defaultValue={values.recipient_legal_name}
                variant={firstIssue(issues, 'recipient_legal_name') ? 'error' : 'default'}
                {...formFieldAttributes(
                  invoiceDraftFormFields.recipient_legal_name,
                  firstIssue(issues, 'recipient_legal_name'),
                )}
              />
            </Field>
            <Field
              label="Billing address line 1"
              error={firstIssue(issues, 'recipient_billing_line1')?.message}
            >
              <Input
                name="recipient_billing_line1"
                defaultValue={values.recipient_billing_line1}
                {...formFieldAttributes(invoiceDraftFormFields.recipient_billing_line1)}
              />
            </Field>
            <Field
              label="Locality or city"
              error={firstIssue(issues, 'recipient_billing_locality')?.message}
            >
              <Input
                name="recipient_billing_locality"
                defaultValue={values.recipient_billing_locality}
                {...formFieldAttributes(invoiceDraftFormFields.recipient_billing_locality)}
              />
            </Field>
            <Field
              label="State or region"
              error={firstIssue(issues, 'recipient_billing_region')?.message}
            >
              <Input
                name="recipient_billing_region"
                defaultValue={values.recipient_billing_region}
                {...formFieldAttributes(invoiceDraftFormFields.recipient_billing_region)}
              />
            </Field>
            <Field
              label="Postal code"
              error={firstIssue(issues, 'recipient_billing_postal_code')?.message}
            >
              <Input
                name="recipient_billing_postal_code"
                defaultValue={values.recipient_billing_postal_code}
                {...formFieldAttributes(invoiceDraftFormFields.recipient_billing_postal_code)}
              />
            </Field>
            <Field label="Country" error={firstIssue(issues, 'recipient_billing_country')?.message}>
              <Input
                name="recipient_billing_country"
                defaultValue={values.recipient_billing_country}
                {...formFieldAttributes(invoiceDraftFormFields.recipient_billing_country)}
              />
            </Field>
            <Field
              label="Tax identifier country"
              error={firstIssue(issues, 'recipient_tax_country')?.message}
            >
              <Input
                name="recipient_tax_country"
                defaultValue={values.recipient_tax_country}
                {...formFieldAttributes(invoiceDraftFormFields.recipient_tax_country)}
              />
            </Field>
            <Field label="Tax identifier type" error={firstIssue(issues, 'recipient_tax_type')?.message}>
              <Input
                name="recipient_tax_type"
                defaultValue={values.recipient_tax_type}
                {...formFieldAttributes(invoiceDraftFormFields.recipient_tax_type)}
              />
            </Field>
            <Field
              label="Tax identifier value"
              error={firstIssue(issues, 'recipient_tax_value')?.message}
            >
              <Input
                name="recipient_tax_value"
                defaultValue={values.recipient_tax_value}
                {...formFieldAttributes(invoiceDraftFormFields.recipient_tax_value)}
              />
            </Field>
            <Field
              label="Tax State/UT code"
              error={firstIssue(issues, 'recipient_tax_state_code')?.message}
            >
              <Input
                name="recipient_tax_state_code"
                defaultValue={values.recipient_tax_state_code}
                {...formFieldAttributes(invoiceDraftFormFields.recipient_tax_state_code)}
              />
            </Field>
          </div>
        </section>

        <section aria-labelledby="invoice-tax-heading" data-gap="form" mix={cardStyle}>
          <h2 id="invoice-tax-heading" mix={sectionHeadingStyle}>
            Tax treatment
          </h2>
          <div mix={gridStyle}>
            <Field label="Invoice tax mode" error={firstIssue(issues, 'gst_mode')?.message}>
              <select
                name="gst_mode"
                {...formFieldAttributes(invoiceDraftFormFields.gst_mode, firstIssue(issues, 'gst_mode'))}
              >
                <option value="none" selected={values.gst_mode === 'none'}>
                  No tax
                </option>
                {gstRatePresets.length > 0 ? (
                  <option value="india_gst" selected={values.gst_mode === 'india_gst'}>
                    Indian GST
                  </option>
                ) : null}
                <option value="foreign_manual" selected={values.gst_mode === 'foreign_manual'}>
                  Manual foreign tax
                </option>
              </select>
            </Field>
          </div>
          {gstRatePresets.length > 0 ? (
            <>
              <p mix={hintStyle}>
                Select the tax treatment and configured rate for each service. Rates are never
                inferred from SAC codes.
              </p>
            <div mix={gridStyle}>
              <Field label="Supply classification" error={firstIssue(issues, 'supply_type')?.message}>
                <select
                  name="supply_type"
                  {...formFieldAttributes(invoiceDraftFormFields.supply_type, firstIssue(issues, 'supply_type'))}
                >
                  <option value="domestic" selected={values.supply_type === 'domestic'}>
                    Domestic
                  </option>
                  <option value="export_lut" selected={values.supply_type === 'export_lut'}>
                    Export under LUT/Bond (without IGST)
                  </option>
                  <option value="export_igst" selected={values.supply_type === 'export_igst'}>
                    Export with IGST
                  </option>
                </select>
              </Field>
              <Field label="Place of Supply State/UT" error={firstIssue(issues, 'place_of_supply_state_code')?.message}>
                <select
                  name="place_of_supply_state_code"
                  disabled={values.supply_type === 'export_lut' || values.supply_type === 'export_igst'}
                  {...formFieldAttributes(
                    invoiceDraftFormFields.place_of_supply_state_code,
                    firstIssue(issues, 'place_of_supply_state_code'),
                  )}
                >
                  <option value="" selected={values.place_of_supply_state_code === ''}>
                    Choose a State/UT
                  </option>
                  {INDIA_STATES.map((state) => (
                    <option
                      key={state.code}
                      value={state.code}
                      selected={values.place_of_supply_state_code === state.code}
                    >
                      {state.code} — {state.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Export Place of Supply country" error={firstIssue(issues, 'place_of_supply_country')?.message}>
                <Input
                  name="place_of_supply_country"
                  list="invoice-countries"
                  defaultValue={values.place_of_supply_country}
                  variant={firstIssue(issues, 'place_of_supply_country') ? 'error' : 'default'}
                  {...formFieldAttributes(
                    invoiceDraftFormFields.place_of_supply_country,
                    firstIssue(issues, 'place_of_supply_country'),
                  )}
                />
                <datalist id="invoice-countries">
                  {COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </datalist>
              </Field>
              <Field label="Export reference" error={firstIssue(issues, 'export_reference')?.message}>
                <Input
                  name="export_reference"
                  defaultValue={values.export_reference}
                  variant={firstIssue(issues, 'export_reference') ? 'error' : 'default'}
                  {...formFieldAttributes(
                    invoiceDraftFormFields.export_reference,
                    firstIssue(issues, 'export_reference'),
                  )}
                />
              </Field>
              <Field label="Recipient GSTIN applicable" error={firstIssue(issues, 'recipient_gstin_applicable')?.message}>
                <input
                  type="checkbox"
                  name="recipient_gstin_applicable"
                  value="on"
                  checked={values.recipient_gstin_applicable === 'on'}
                  {...formFieldAttributes(invoiceDraftFormFields.recipient_gstin_applicable)}
                />
              </Field>
              <Field label="Reverse charge" error={firstIssue(issues, 'reverse_charge')?.message}>
                <input
                  type="checkbox"
                  name="reverse_charge"
                  value="on"
                  checked={values.reverse_charge === 'on'}
                  {...formFieldAttributes(invoiceDraftFormFields.reverse_charge)}
                />
              </Field>
            </div>
            </>
          ) : null}
        </section>

        <section aria-labelledby="invoice-lines-heading" data-gap="form" mix={cardStyle}>
          <h2 id="invoice-lines-heading" mix={sectionHeadingStyle}>
            Service lines
          </h2>
          <p mix={hintStyle}>
            At least one line is required. Leave a row completely blank to omit it.
          </p>
          {linesIssue || firstIssue(issues, 'lines_count') ? (
            <p role="alert">{linesIssue?.message ?? firstIssue(issues, 'lines_count')?.message}</p>
          ) : null}
          {firstIssue(issues, 'total') ? (
            <p role="alert">{firstIssue(issues, 'total')?.message}</p>
          ) : null}
          <InvoiceFormLines values={values} issues={issues} gstRatePresets={gstRatePresets} />
        </section>

        <section aria-labelledby="invoice-discount-heading" data-gap="form" mix={cardStyle}>
          <h2 id="invoice-discount-heading" mix={sectionHeadingStyle}>
            Invoice discount and round-off
          </h2>
          <p mix={hintStyle}>
            An invoice-wide discount is allocated proportionally across each line's value after
            line discounts. Round-off is optional and adjusts the net total to the nearest whole
            currency unit; exact halfway amounts round away from zero.
          </p>
          <div mix={gridStyle}>
            <Field
              label="Invoice discount type"
              error={firstIssue(issues, 'invoice_discount_mode')?.message}
            >
              <select
                name="invoice_discount_mode"
                {...formFieldAttributes(
                  invoiceDraftFormFields.invoice_discount_mode,
                  firstIssue(issues, 'invoice_discount_mode'),
                )}
              >
                <option value="" selected={values.invoice_discount_mode === ''}>
                  No discount
                </option>
                <option value="percent" selected={values.invoice_discount_mode === 'percent'}>
                  Percentage
                </option>
                <option value="fixed" selected={values.invoice_discount_mode === 'fixed'}>
                  Fixed amount
                </option>
              </select>
            </Field>
            <Field
              label="Invoice discount value"
              error={firstIssue(issues, 'invoice_discount_value')?.message}
            >
              <Input
                name="invoice_discount_value"
                defaultValue={values.invoice_discount_value}
                variant={firstIssue(issues, 'invoice_discount_value') ? 'error' : 'default'}
                {...formFieldAttributes(
                  invoiceDraftFormFields.invoice_discount_value,
                  firstIssue(issues, 'invoice_discount_value'),
                )}
              />
            </Field>
            <Field label="Round-off" error={firstIssue(issues, 'round_off')?.message}>
              <Input
                name="round_off"
                defaultValue={values.round_off}
                variant={firstIssue(issues, 'round_off') ? 'error' : 'default'}
                {...formFieldAttributes(
                  invoiceDraftFormFields.round_off,
                  firstIssue(issues, 'round_off'),
                )}
              />
            </Field>
          </div>
        </section>

        <section aria-labelledby="invoice-notes-heading" data-gap="form" mix={cardStyle}>
          <h2 id="invoice-notes-heading" mix={sectionHeadingStyle}>
            Notes and instructions
          </h2>
          <Field
            label="Payment instructions"
            hint="Visible to the Client on the invoice."
            error={firstIssue(issues, 'payment_instructions')?.message}
          >
            <textarea
              name="payment_instructions"
              mix={textAreaStyle}
              defaultValue={values.payment_instructions}
              {...formFieldAttributes(
                invoiceDraftFormFields.payment_instructions,
                firstIssue(issues, 'payment_instructions'),
              )}
            />
          </Field>
          <Field
            label="Customer notes"
            hint="Visible to the Client on the invoice."
            error={firstIssue(issues, 'customer_notes')?.message}
          >
            <textarea
              name="customer_notes"
              mix={textAreaStyle}
              defaultValue={values.customer_notes}
              {...formFieldAttributes(
                invoiceDraftFormFields.customer_notes,
                firstIssue(issues, 'customer_notes'),
              )}
            />
          </Field>
          <Field
            label="Internal note"
            hint="Private to your Organization. Never shown to the Client."
            error={firstIssue(issues, 'internal_note')?.message}
          >
            <textarea
              name="internal_note"
              mix={textAreaStyle}
              defaultValue={values.internal_note}
              {...formFieldAttributes(
                invoiceDraftFormFields.internal_note,
                firstIssue(issues, 'internal_note'),
              )}
            />
          </Field>
        </section>

        <div mix={formActionsStyle}>
          <Button type="submit" name="_intent" value="add_line" variant="secondary">
            Add another line
          </Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </RestfulForm>
    );
  };
}
