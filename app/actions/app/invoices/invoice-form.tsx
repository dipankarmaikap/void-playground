import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';
import type { Issue } from 'remix/data-schema';

import { COUNTRIES, CURRENCIES } from '../../../data/client-billing.ts';
import { PAYMENT_TERMS, PAYMENT_TERM_LABELS } from '../../../data/organization-invoicing.ts';
import { INDIA_STATES } from '../../../data/india-states.ts';
import { Button } from '../../../ui/button.tsx';
import { Field } from '../../../ui/field.tsx';
import { Input } from '../../../ui/input.tsx';
import { colors, radius } from '../../../ui/theme.ts';
import { MIN_VISIBLE_LINES } from './form-intent.ts';
import type { InvoiceFormValues } from './form-values.ts';

export interface InvoiceFormProps {
  csrfToken: string;
  action: string;
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

const cardStyle = css({
  display: 'grid',
  gap: '1rem',
  padding: '1.25rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
});

const gridStyle = css({
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))',
});

const lineRowStyle = css({
  display: 'grid',
  gap: '0.75rem',
  padding: '1rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
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

function lineIssue(
  issues: readonly Issue[],
  index: number,
  field: string,
): Issue | undefined {
  return issues.find(
    (issue) => issue.path?.[0] === 'lines' && issue.path?.[1] === index && issue.path?.[2] === field,
  );
}

export function InvoiceForm(handle: Handle<InvoiceFormProps>) {
  return () => {
    let {
      csrfToken,
      action,
      submitLabel,
      values,
      issues = [],
      children,
      gstRatePresets,
    } = handle.props;
    let lineCount = Math.max(MIN_VISIBLE_LINES, values.lines.length);
    let linesIssue = firstIssue(issues, 'lines');

    return (
      <form method="post" action={action} mix={formStyle}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        <input type="hidden" name="client_id" value={values.client_id} />
        <input
          type="hidden"
          name="recipient_tax_state_name"
          value={values.recipient_tax_state_name}
        />
        {children}
        {issues.length > 0 ? (
          <p role="alert">Please correct the fields below.</p>
        ) : null}
        {!gstRatePresets.length && firstIssue(issues, 'gst_mode') ? (
          <p role="alert">{firstIssue(issues, 'gst_mode')?.message}</p>
        ) : null}
        {firstIssue(issues, 'client_id') ? (
          <p role="alert">{firstIssue(issues, 'client_id')?.message}</p>
        ) : null}

        <section aria-labelledby="invoice-basics-heading" mix={cardStyle}>
          <h2 id="invoice-basics-heading" mix={sectionHeadingStyle}>
            Invoice details
          </h2>
          <div mix={gridStyle}>
            <Field label="Currency" error={firstIssue(issues, 'currency')?.message}>
              <Input
                name="currency"
                list="invoice-currencies"
                maxLength={3}
                defaultValue={values.currency}
                variant={firstIssue(issues, 'currency') ? 'error' : 'default'}
                aria-invalid={firstIssue(issues, 'currency') ? true : undefined}
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
                type="date"
                defaultValue={values.invoice_date}
                variant={firstIssue(issues, 'invoice_date') ? 'error' : 'default'}
                aria-invalid={firstIssue(issues, 'invoice_date') ? true : undefined}
              />
            </Field>
            <Field label="Due date" error={firstIssue(issues, 'due_date')?.message}>
              <Input
                name="due_date"
                type="date"
                defaultValue={values.due_date}
                variant={firstIssue(issues, 'due_date') ? 'error' : 'default'}
                aria-invalid={firstIssue(issues, 'due_date') ? true : undefined}
              />
            </Field>
            <Field label="Payment term" error={firstIssue(issues, 'payment_term')?.message}>
              <select name="payment_term">
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
                maxLength={200}
                mix={textAreaStyle}
                defaultValue={values.custom_payment_terms}
                aria-invalid={firstIssue(issues, 'custom_payment_terms') ? true : undefined}
              />
            </Field>
          </div>
        </section>

        <section aria-labelledby="invoice-recipient-heading" mix={cardStyle}>
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
                aria-invalid={firstIssue(issues, 'recipient_legal_name') ? true : undefined}
              />
            </Field>
            <Field
              label="Billing address line 1"
              error={firstIssue(issues, 'recipient_billing_line1')?.message}
            >
              <Input name="recipient_billing_line1" defaultValue={values.recipient_billing_line1} />
            </Field>
            <Field
              label="Locality or city"
              error={firstIssue(issues, 'recipient_billing_locality')?.message}
            >
              <Input
                name="recipient_billing_locality"
                defaultValue={values.recipient_billing_locality}
              />
            </Field>
            <Field
              label="State or region"
              error={firstIssue(issues, 'recipient_billing_region')?.message}
            >
              <Input name="recipient_billing_region" defaultValue={values.recipient_billing_region} />
            </Field>
            <Field
              label="Postal code"
              error={firstIssue(issues, 'recipient_billing_postal_code')?.message}
            >
              <Input
                name="recipient_billing_postal_code"
                defaultValue={values.recipient_billing_postal_code}
              />
            </Field>
            <Field label="Country" error={firstIssue(issues, 'recipient_billing_country')?.message}>
              <Input name="recipient_billing_country" defaultValue={values.recipient_billing_country} />
            </Field>
            <Field
              label="Tax identifier country"
              error={firstIssue(issues, 'recipient_tax_country')?.message}
            >
              <Input name="recipient_tax_country" defaultValue={values.recipient_tax_country} />
            </Field>
            <Field label="Tax identifier type" error={firstIssue(issues, 'recipient_tax_type')?.message}>
              <Input name="recipient_tax_type" defaultValue={values.recipient_tax_type} />
            </Field>
            <Field
              label="Tax identifier value"
              error={firstIssue(issues, 'recipient_tax_value')?.message}
            >
              <Input name="recipient_tax_value" defaultValue={values.recipient_tax_value} />
            </Field>
            <Field
              label="Tax State/UT code"
              error={firstIssue(issues, 'recipient_tax_state_code')?.message}
            >
              <Input name="recipient_tax_state_code" defaultValue={values.recipient_tax_state_code} />
            </Field>
          </div>
        </section>

        <section aria-labelledby="invoice-tax-heading" mix={cardStyle}>
          <h2 id="invoice-tax-heading" mix={sectionHeadingStyle}>
            Tax treatment
          </h2>
          <div mix={gridStyle}>
            <Field label="Invoice tax mode" error={firstIssue(issues, 'gst_mode')?.message}>
              <select name="gst_mode" aria-invalid={firstIssue(issues, 'gst_mode') ? true : undefined}>
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
                <select name="supply_type" aria-invalid={firstIssue(issues, 'supply_type') ? true : undefined}>
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
                  aria-invalid={
                    firstIssue(issues, 'place_of_supply_state_code') ? true : undefined
                  }
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
                  maxLength={200}
                  defaultValue={values.export_reference}
                  variant={firstIssue(issues, 'export_reference') ? 'error' : 'default'}
                />
              </Field>
              <Field label="Recipient GSTIN applicable" error={firstIssue(issues, 'recipient_gstin_applicable')?.message}>
                <input
                  type="checkbox"
                  name="recipient_gstin_applicable"
                  value="on"
                  checked={values.recipient_gstin_applicable === 'on'}
                />
              </Field>
              <Field label="Reverse charge" error={firstIssue(issues, 'reverse_charge')?.message}>
                <input type="checkbox" name="reverse_charge" value="on" checked={values.reverse_charge === 'on'} />
              </Field>
            </div>
            </>
          ) : null}
        </section>

        <section aria-labelledby="invoice-lines-heading" mix={cardStyle}>
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
          {Array.from({ length: lineCount }, (_, index) => {
            let line = values.lines[index] ?? {
              description: '',
              sac: '',
              quantity: '',
              unit_price: '',
              discount_mode: '',
              discount_value: '',
              tax_treatment: '',
              gst_rate: '',
              foreign_tax_label: '',
              foreign_tax_mode: '',
              foreign_tax_value: '',
            };
            return (
              <div key={index} mix={lineRowStyle}>
                <Field
                  label={`Description ${index + 1}`}
                  error={lineIssue(issues, index, 'description')?.message}
                >
                  <Input
                    name="line_description"
                    defaultValue={line.description}
                    variant={lineIssue(issues, index, 'description') ? 'error' : 'default'}
                    aria-invalid={lineIssue(issues, index, 'description') ? true : undefined}
                  />
                </Field>
                <Field label={`SAC ${index + 1}`} error={lineIssue(issues, index, 'sac')?.message}>
                  <Input name="line_sac" defaultValue={line.sac} />
                </Field>
                <Field
                  label={`Quantity ${index + 1}`}
                  error={lineIssue(issues, index, 'quantity')?.message}
                >
                  <Input
                    name="line_quantity"
                    defaultValue={line.quantity}
                    variant={lineIssue(issues, index, 'quantity') ? 'error' : 'default'}
                    aria-invalid={lineIssue(issues, index, 'quantity') ? true : undefined}
                  />
                </Field>
                <Field
                  label={`Unit price ${index + 1}`}
                  error={lineIssue(issues, index, 'unit_price')?.message}
                >
                  <Input
                    name="line_unit_price"
                    defaultValue={line.unit_price}
                    variant={lineIssue(issues, index, 'unit_price') ? 'error' : 'default'}
                    aria-invalid={lineIssue(issues, index, 'unit_price') ? true : undefined}
                  />
                </Field>
                <Field
                  label={`Discount type ${index + 1}`}
                  error={lineIssue(issues, index, 'discount_mode')?.message}
                >
                  <select
                    name="line_discount_mode"
                    aria-invalid={lineIssue(issues, index, 'discount_mode') ? true : undefined}
                  >
                    <option value="" selected={line.discount_mode === ''}>
                      No discount
                    </option>
                    <option value="percent" selected={line.discount_mode === 'percent'}>
                      Percentage
                    </option>
                    <option value="fixed" selected={line.discount_mode === 'fixed'}>
                      Fixed amount
                    </option>
                  </select>
                </Field>
                <Field
                  label={`Discount ${index + 1}`}
                  error={lineIssue(issues, index, 'discount_value')?.message}
                >
                  <Input
                    name="line_discount_value"
                    defaultValue={line.discount_value}
                    variant={lineIssue(issues, index, 'discount_value') ? 'error' : 'default'}
                    aria-invalid={lineIssue(issues, index, 'discount_value') ? true : undefined}
                  />
                </Field>
                {gstRatePresets.length > 0 ? (
                  <>
                    <Field
                      label={`GST treatment ${index + 1}`}
                      error={lineIssue(issues, index, 'tax_treatment')?.message}
                    >
                      <select
                        name="line_tax_treatment"
                        aria-invalid={
                          lineIssue(issues, index, 'tax_treatment') ? true : undefined
                        }
                      >
                        <option value="" selected={line.tax_treatment === ''}>
                          Choose treatment
                        </option>
                        <option value="taxable" selected={line.tax_treatment === 'taxable'}>
                          Taxable
                        </option>
                        <option value="nil_rated" selected={line.tax_treatment === 'nil_rated'}>
                          Nil-rated
                        </option>
                        <option value="exempt" selected={line.tax_treatment === 'exempt'}>
                          Exempt
                        </option>
                        <option value="non_gst" selected={line.tax_treatment === 'non_gst'}>
                          Non-GST
                        </option>
                      </select>
                    </Field>
                    <Field
                      label={`GST rate ${index + 1}`}
                      error={lineIssue(issues, index, 'gst_rate')?.message}
                    >
                      <select
                        name="line_gst_rate"
                        aria-invalid={lineIssue(issues, index, 'gst_rate') ? true : undefined}
                      >
                        <option value="" selected={line.gst_rate === ''}>
                          Choose rate
                        </option>
                        {gstRatePresets.map((rate) => (
                          <option key={rate} value={rate} selected={line.gst_rate === rate}>
                            {rate}%
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                ) : null}
                <Field
                  label={`Manual tax label ${index + 1}`}
                  error={lineIssue(issues, index, 'foreign_tax_label')?.message}
                >
                  <Input
                    name="line_foreign_tax_label"
                    maxLength={80}
                    defaultValue={line.foreign_tax_label}
                    variant={lineIssue(issues, index, 'foreign_tax_label') ? 'error' : 'default'}
                  />
                </Field>
                <Field
                  label={`Manual tax type ${index + 1}`}
                  error={lineIssue(issues, index, 'foreign_tax_mode')?.message}
                >
                  <select name="line_foreign_tax_mode">
                    <option value="" selected={line.foreign_tax_mode === ''}>No manual tax</option>
                    <option value="percent" selected={line.foreign_tax_mode === 'percent'}>Percentage</option>
                    <option value="fixed" selected={line.foreign_tax_mode === 'fixed'}>Fixed invoice-currency amount</option>
                  </select>
                </Field>
                <Field
                  label={`Manual tax rate or amount ${index + 1}`}
                  error={lineIssue(issues, index, 'foreign_tax_value')?.message}
                >
                  <Input
                    name="line_foreign_tax_value"
                    defaultValue={line.foreign_tax_value}
                    variant={lineIssue(issues, index, 'foreign_tax_value') ? 'error' : 'default'}
                  />
                </Field>
                {lineIssue(issues, index, 'amount') ? (
                  <p role="alert">{lineIssue(issues, index, 'amount')?.message}</p>
                ) : null}
              </div>
            );
          })}
        </section>

        <section aria-labelledby="invoice-discount-heading" mix={cardStyle}>
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
                aria-invalid={firstIssue(issues, 'invoice_discount_mode') ? true : undefined}
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
                aria-invalid={firstIssue(issues, 'invoice_discount_value') ? true : undefined}
              />
            </Field>
            <Field label="Round-off" error={firstIssue(issues, 'round_off')?.message}>
              <Input
                name="round_off"
                defaultValue={values.round_off}
                variant={firstIssue(issues, 'round_off') ? 'error' : 'default'}
                aria-invalid={firstIssue(issues, 'round_off') ? true : undefined}
              />
            </Field>
          </div>
        </section>

        <section aria-labelledby="invoice-notes-heading" mix={cardStyle}>
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
              maxLength={1000}
              mix={textAreaStyle}
              defaultValue={values.payment_instructions}
              aria-invalid={firstIssue(issues, 'payment_instructions') ? true : undefined}
            />
          </Field>
          <Field
            label="Customer notes"
            hint="Visible to the Client on the invoice."
            error={firstIssue(issues, 'customer_notes')?.message}
          >
            <textarea
              name="customer_notes"
              maxLength={1000}
              mix={textAreaStyle}
              defaultValue={values.customer_notes}
              aria-invalid={firstIssue(issues, 'customer_notes') ? true : undefined}
            />
          </Field>
          <Field
            label="Internal note"
            hint="Private to your Organization. Never shown to the Client."
            error={firstIssue(issues, 'internal_note')?.message}
          >
            <textarea
              name="internal_note"
              maxLength={1000}
              mix={textAreaStyle}
              defaultValue={values.internal_note}
              aria-invalid={firstIssue(issues, 'internal_note') ? true : undefined}
            />
          </Field>
        </section>

        <div mix={formActionsStyle}>
          <Button type="submit" name="_intent" value="add_line" variant="secondary">
            Add another line
          </Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    );
  };
}
