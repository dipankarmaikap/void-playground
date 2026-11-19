import type { Handle } from 'remix/component';
import { css } from 'remix/component';
import type { Issue } from 'remix/data-schema';

import { Field } from '../../../ui/field.tsx';
import { Input } from '../../../ui/input.tsx';
import { formFieldAttributes } from '../../../ui/public/form-field.ts';
import { colors, radius } from '../../../ui/theme.ts';
import { MIN_VISIBLE_LINES } from './form-intent.ts';
import type { InvoiceFormValues } from './form-values.ts';
import { invoiceDraftFormFields } from './public/schema.ts';

export interface InvoiceFormLinesProps {
  values: InvoiceFormValues;
  issues: readonly Issue[];
  gstRatePresets: readonly string[];
}

const lineRowStyle = css({
  display: 'grid',
  gap: '0.75rem',
  padding: '1rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
});

function lineIssue(
  issues: readonly Issue[],
  index: number,
  field: string,
): Issue | undefined {
  return issues.find(
    (issue) => issue.path?.[0] === 'lines' && issue.path?.[1] === index && issue.path?.[2] === field,
  );
}

/** The editable service-line rows of the invoice form, including GST and manual-tax fields. */
export function InvoiceFormLines(handle: Handle<InvoiceFormLinesProps>) {
  return () => {
    let { values, issues, gstRatePresets } = handle.props;
    let lineCount = Math.max(MIN_VISIBLE_LINES, values.lines.length);

    return (
      <>
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
          let foreignTaxLabelIssue = lineIssue(issues, index, 'foreign_tax_label');
          let foreignTaxModeIssue = lineIssue(issues, index, 'foreign_tax_mode');
          let foreignTaxValueIssue = lineIssue(issues, index, 'foreign_tax_value');
          let foreignTaxLabelErrorId = `line-${index}-foreign-tax-label-error`;
          let foreignTaxModeErrorId = `line-${index}-foreign-tax-mode-error`;
          let foreignTaxValueErrorId = `line-${index}-foreign-tax-value-error`;
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
                  {...formFieldAttributes(
                    invoiceDraftFormFields.line_description,
                    lineIssue(issues, index, 'description'),
                  )}
                />
              </Field>
              <Field label={`SAC ${index + 1}`} error={lineIssue(issues, index, 'sac')?.message}>
                <Input
                  name="line_sac"
                  defaultValue={line.sac}
                  {...formFieldAttributes(invoiceDraftFormFields.line_sac)}
                />
              </Field>
              <Field
                label={`Quantity ${index + 1}`}
                error={lineIssue(issues, index, 'quantity')?.message}
              >
                <Input
                  name="line_quantity"
                  defaultValue={line.quantity}
                  variant={lineIssue(issues, index, 'quantity') ? 'error' : 'default'}
                  {...formFieldAttributes(
                    invoiceDraftFormFields.line_quantity,
                    lineIssue(issues, index, 'quantity'),
                  )}
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
                  {...formFieldAttributes(
                    invoiceDraftFormFields.line_unit_price,
                    lineIssue(issues, index, 'unit_price'),
                  )}
                />
              </Field>
              <Field
                label={`Discount type ${index + 1}`}
                error={lineIssue(issues, index, 'discount_mode')?.message}
              >
                <select
                  name="line_discount_mode"
                  {...formFieldAttributes(
                    invoiceDraftFormFields.line_discount_mode,
                    lineIssue(issues, index, 'discount_mode'),
                  )}
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
                  {...formFieldAttributes(
                    invoiceDraftFormFields.line_discount_value,
                    lineIssue(issues, index, 'discount_value'),
                  )}
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
                      {...formFieldAttributes(
                        invoiceDraftFormFields.line_tax_treatment,
                        lineIssue(issues, index, 'tax_treatment'),
                      )}
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
                      {...formFieldAttributes(
                        invoiceDraftFormFields.line_gst_rate,
                        lineIssue(issues, index, 'gst_rate'),
                      )}
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
                error={foreignTaxLabelIssue?.message}
                errorId={foreignTaxLabelIssue ? foreignTaxLabelErrorId : undefined}
              >
                <Input
                  id={`line-${index}-foreign-tax-label`}
                  name="line_foreign_tax_label"
                  defaultValue={line.foreign_tax_label}
                  variant={foreignTaxLabelIssue ? 'error' : 'default'}
                  {...formFieldAttributes(
                    invoiceDraftFormFields.line_foreign_tax_label,
                    foreignTaxLabelIssue,
                  )}
                  aria-describedby={foreignTaxLabelIssue ? foreignTaxLabelErrorId : undefined}
                />
              </Field>
              <Field
                label={`Manual tax type ${index + 1}`}
                error={foreignTaxModeIssue?.message}
                errorId={foreignTaxModeIssue ? foreignTaxModeErrorId : undefined}
              >
                <select
                  id={`line-${index}-foreign-tax-mode`}
                  name="line_foreign_tax_mode"
                  aria-describedby={foreignTaxModeIssue ? foreignTaxModeErrorId : undefined}
                  {...formFieldAttributes(
                    invoiceDraftFormFields.line_foreign_tax_mode,
                    foreignTaxModeIssue,
                  )}
                >
                  <option value="" selected={line.foreign_tax_mode === ''}>No manual tax</option>
                  <option value="percent" selected={line.foreign_tax_mode === 'percent'}>Percentage</option>
                  <option value="fixed" selected={line.foreign_tax_mode === 'fixed'}>Fixed invoice-currency amount</option>
                </select>
              </Field>
              <Field
                label={`Manual tax rate or amount ${index + 1}`}
                error={foreignTaxValueIssue?.message}
                errorId={foreignTaxValueIssue ? foreignTaxValueErrorId : undefined}
              >
                <Input
                  id={`line-${index}-foreign-tax-value`}
                  name="line_foreign_tax_value"
                  defaultValue={line.foreign_tax_value}
                  variant={foreignTaxValueIssue ? 'error' : 'default'}
                  aria-describedby={foreignTaxValueIssue ? foreignTaxValueErrorId : undefined}
                  {...formFieldAttributes(
                    invoiceDraftFormFields.line_foreign_tax_value,
                    foreignTaxValueIssue,
                  )}
                />
              </Field>
              {lineIssue(issues, index, 'amount') ? (
                <p role="alert">{lineIssue(issues, index, 'amount')?.message}</p>
              ) : null}
            </div>
          );
        })}
      </>
    );
  };
}
