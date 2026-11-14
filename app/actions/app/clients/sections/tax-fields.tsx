import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import {
  duplicateTaxWarning,
  findClientWithTaxValue,
  parseClientTax,
} from '../../../../data/client-tax.ts';
import { INDIA_STATES } from '../../../../data/india-states.ts';
import { Field } from '../../../../ui/field.tsx';
import { Input } from '../../../../ui/input.tsx';
import { Select } from '../../../../ui/select.tsx';
import type { ClientFormValues } from '../form-values.ts';
import { issueFor, readText } from '../form-values.ts';
import type { ClientFormSection, ClientFormSectionProps } from './registry.ts';

const taxGroupStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
});

export function TaxFields(handle: Handle<ClientFormSectionProps>) {
  return () => {
    let { values, issues } = handle.props;
    let countryIssue = issueFor(issues, 'tax_country');
    let typeIssue = issueFor(issues, 'tax_type');
    let valueIssue = issueFor(issues, 'tax_value');
    let stateIssue = issueFor(issues, 'tax_state_code');

    return (
      <div mix={taxGroupStyle}>
        <Field
          label="Tax identifier country"
          hint="Optional. Enter IN for India; otherwise use the country name or code."
          error={countryIssue?.message}
        >
          <Input
            name="tax_country"
            defaultValue={values.tax_country}
            aria-invalid={countryIssue ? true : undefined}
            variant={countryIssue ? 'error' : 'default'}
          />
        </Field>
        <Field
          label="Tax identifier type"
          hint="Optional. Use GSTIN or UIN for India; elsewhere use the local type, such as VAT or EIN."
          error={typeIssue?.message}
        >
          <Input
            name="tax_type"
            defaultValue={values.tax_type}
            aria-invalid={typeIssue ? true : undefined}
            variant={typeIssue ? 'error' : 'default'}
          />
        </Field>
        <Field
          label="Tax identifier value"
          hint="Optional. Only basic format checks run; the app does not verify identifiers with any tax authority."
          error={valueIssue?.message}
        >
          <Input
            name="tax_value"
            defaultValue={values.tax_value}
            aria-invalid={valueIssue ? true : undefined}
            variant={valueIssue ? 'error' : 'default'}
          />
        </Field>
        <Field
          label="State or UT (India)"
          hint="Choose the State or UT associated with an India GSTIN or UIN."
          error={stateIssue?.message}
        >
          <Select
            name="tax_state_code"
            aria-invalid={stateIssue ? true : undefined}
            variant={stateIssue ? 'error' : 'default'}
          >
            <option value="" selected={!values.tax_state_code}>
              Not recorded
            </option>
            {INDIA_STATES.map((state) => (
              <option
                key={state.code}
                value={state.code}
                selected={values.tax_state_code === state.code}
              >
                {state.name} ({state.code})
              </option>
            ))}
          </Select>
        </Field>
      </div>
    );
  };
}

export const taxSection: ClientFormSection = {
  key: 'tax',
  render: (props) => <TaxFields values={props.values} issues={props.issues} />,
  async parse(formData, context) {
    let values: Partial<ClientFormValues> = {
      tax_country: readText(formData, 'tax_country'),
      tax_type: readText(formData, 'tax_type'),
      tax_value: readText(formData, 'tax_value'),
      tax_state_code: readText(formData, 'tax_state_code'),
    };
    let parsed = parseClientTax({
      tax_country: values.tax_country ?? '',
      tax_type: values.tax_type ?? '',
      tax_value: values.tax_value ?? '',
      tax_state_code: values.tax_state_code ?? '',
    });

    if (!parsed.ok) {
      return {
        values,
        changes: {},
        issues: parsed.issues.map((issue) => ({
          message: issue.message,
          path: [issue.field],
        })),
      };
    }

    let warning: string | undefined;
    if (parsed.value.tax_value) {
      let duplicate = await findClientWithTaxValue(
        parsed.value.tax_value,
        context?.clientId,
      );
      if (duplicate) {
        warning = duplicateTaxWarning(parsed.value.tax_value, duplicate);
      }
    }

    return { values, changes: parsed.value, issues: [], warning };
  },
};
