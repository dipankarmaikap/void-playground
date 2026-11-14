import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import {
  COUNTRIES,
  CURRENCIES,
  parseClientBilling,
} from '../../../../data/client-billing.ts';
import { Field } from '../../../../ui/field.tsx';
import { Input } from '../../../../ui/input.tsx';
import { Select } from '../../../../ui/select.tsx';
import { issueFor, readText } from '../form-values.ts';
import type { ClientFormValues } from '../form-values.ts';
import type { ClientFormSection, ClientFormSectionProps } from './registry.ts';

const addressGroupStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
});

export function BillingFields(handle: Handle<ClientFormSectionProps>) {
  return () => {
    let { values, issues } = handle.props;
    let line1Issue = issueFor(issues, 'billing_line1');
    let localityIssue = issueFor(issues, 'billing_locality');
    let regionIssue = issueFor(issues, 'billing_region');
    let postalCodeIssue = issueFor(issues, 'billing_postal_code');
    let countryIssue = issueFor(issues, 'billing_country');
    let currencyIssue = issueFor(issues, 'billing_currency');
    let countryValue = values.billing_country.trim().toUpperCase();
    let currencyValue = values.billing_currency.trim().toUpperCase();
    let hasKnownCountry = COUNTRIES.some((country) => country.code === countryValue);
    let hasKnownCurrency = CURRENCIES.some((currency) => currency.code === currencyValue);

    return (
      <>
        <div mix={addressGroupStyle}>
          <Field
            label="Billing address line 1"
            hint="Optional. If you enter any address field, line 1 and country are required."
            error={line1Issue?.message}
          >
            <Input
              name="billing_line1"
              autoComplete="address-line1"
              defaultValue={values.billing_line1}
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
              name="billing_locality"
              autoComplete="address-level2"
              defaultValue={values.billing_locality}
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
              name="billing_region"
              autoComplete="address-level1"
              defaultValue={values.billing_region}
              aria-invalid={regionIssue ? true : undefined}
              variant={regionIssue ? 'error' : 'default'}
            />
          </Field>
          <Field label="Postal code" hint="Optional." error={postalCodeIssue?.message}>
            <Input
              name="billing_postal_code"
              autoComplete="postal-code"
              defaultValue={values.billing_postal_code}
              aria-invalid={postalCodeIssue ? true : undefined}
              variant={postalCodeIssue ? 'error' : 'default'}
            />
          </Field>
          <Field
            label="Billing country"
            hint="Required when you enter a billing address."
            error={countryIssue?.message}
          >
            <Select
              name="billing_country"
              autoComplete="country"
              aria-invalid={countryIssue ? true : undefined}
              variant={countryIssue ? 'error' : 'default'}
            >
              <option value="">Not set</option>
              {countryValue && !hasKnownCountry ? (
                <option value={countryValue} selected>
                  {countryValue} — not recognized
                </option>
              ) : null}
              {COUNTRIES.map((country) => (
                <option
                  key={country.code}
                  value={country.code}
                  selected={countryValue === country.code}
                >
                  {country.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Default billing currency"
          hint="Optional. Leave blank to use the suggested currency for the billing country. You can also pick a currency without an address; no conversion is applied."
          error={currencyIssue?.message}
        >
          <Select
            name="billing_currency"
            aria-invalid={currencyIssue ? true : undefined}
            variant={currencyIssue ? 'error' : 'default'}
          >
            <option value="">Suggested from country</option>
            {currencyValue && !hasKnownCurrency ? (
              <option value={currencyValue} selected>
                {currencyValue} — not recognized
              </option>
            ) : null}
            {CURRENCIES.map((currency) => (
              <option
                key={currency.code}
                value={currency.code}
                selected={currencyValue === currency.code}
              >
                {currency.code} — {currency.name}
              </option>
            ))}
          </Select>
        </Field>
      </>
    );
  };
}

export const billingSection: ClientFormSection = {
  key: 'billing',
  render: (props) => <BillingFields values={props.values} issues={props.issues} />,
  parse(formData) {
    let values: ClientFormValues = {
      type: '',
      legal_name: '',
      preferred_name: '',
      trading_name: '',
      industry: '',
      billing_line1: readText(formData, 'billing_line1'),
      billing_locality: readText(formData, 'billing_locality'),
      billing_region: readText(formData, 'billing_region'),
      billing_postal_code: readText(formData, 'billing_postal_code'),
      billing_country: readText(formData, 'billing_country'),
      billing_currency: readText(formData, 'billing_currency'),
    };
    let parsed = parseClientBilling(values);

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

    return { values, changes: parsed.value, issues: [] };
  },
};
