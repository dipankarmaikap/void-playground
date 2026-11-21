import type { Handle } from 'remix/component';

import {
  COUNTRIES,
  CURRENCIES,
  countryName,
  currencyName,
  findCountry,
  parseClientBilling,
  suggestCurrencyForCountry,
} from '../../../../data/client-billing.ts';
import { Field } from '../../../../ui/field.tsx';
import { Input } from '../../../../ui/input.tsx';
import { formStackStyle } from '../../../../ui/page-styles.ts';
import { formFieldAttributes } from '../../../../ui/public/form-field.ts';
import { issueFor } from '../form-values.ts';
import { clientFormFields } from '../public/schema.ts';
import type { ClientFormSection, ClientFormSectionProps } from './registry.ts';

export function BillingFields(handle: Handle<ClientFormSectionProps>) {
  return () => {
    let { values, issues } = handle.props;
    let line1Issue = issueFor(issues, 'billing_line1');
    let localityIssue = issueFor(issues, 'billing_locality');
    let regionIssue = issueFor(issues, 'billing_region');
    let postalCodeIssue = issueFor(issues, 'billing_postal_code');
    let countryIssue = issueFor(issues, 'billing_country');
    let currencyIssue = issueFor(issues, 'billing_currency');
    let country = findCountry(values.billing_country);
    let suggestedCurrency = suggestCurrencyForCountry(values.billing_country);
    let suggestedCurrencyName = suggestedCurrency ? currencyName(suggestedCurrency) : null;
    let currencyHint =
      'Optional. Enter a 3-letter code such as INR or USD, or pick a suggestion. No conversion is applied.';
    if (suggestedCurrency) {
      currencyHint += ` Suggested for ${country?.name ?? countryName(values.billing_country)}: ${suggestedCurrency}${suggestedCurrencyName ? ` — ${suggestedCurrencyName}` : ''}. Leave blank to record no currency.`;
    }

    return (
      <>
        <div mix={formStackStyle}>
          <Field
            label="Billing address line 1"
            hint="Optional. If you enter any address field, line 1 and country are required."
            error={line1Issue?.message}
          >
            <Input
              name="billing_line1"
              autoComplete="address-line1"
              defaultValue={values.billing_line1}
              variant={line1Issue ? 'error' : 'default'}
              {...formFieldAttributes(clientFormFields.billing_line1, line1Issue)}
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
              variant={localityIssue ? 'error' : 'default'}
              {...formFieldAttributes(clientFormFields.billing_locality, localityIssue)}
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
              variant={regionIssue ? 'error' : 'default'}
              {...formFieldAttributes(clientFormFields.billing_region, regionIssue)}
            />
          </Field>
          <Field label="Postal code" hint="Optional." error={postalCodeIssue?.message}>
            <Input
              name="billing_postal_code"
              autoComplete="postal-code"
              defaultValue={values.billing_postal_code}
              variant={postalCodeIssue ? 'error' : 'default'}
              {...formFieldAttributes(clientFormFields.billing_postal_code, postalCodeIssue)}
            />
          </Field>
          <Field
            label="Billing country"
            hint="Required when you enter a billing address. Type any country; known names and codes are suggestions."
            error={countryIssue?.message}
          >
            <Input
              name="billing_country"
              list="billing-countries"
              autoComplete="country-name"
              defaultValue={
                countryIssue ? values.billing_country : countryName(values.billing_country)
              }
              variant={countryIssue ? 'error' : 'default'}
              {...formFieldAttributes(clientFormFields.billing_country, countryIssue)}
            />
            <datalist id="billing-countries">
              {COUNTRIES.map((option) => (
                <option key={option.code} value={option.name} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field
          label="Default billing currency"
          hint={currencyHint}
          error={currencyIssue?.message}
        >
          <Input
            name="billing_currency"
            list="billing-currencies"
            defaultValue={
              currencyIssue
                ? values.billing_currency
                : values.billing_currency.trim().toUpperCase()
            }
            variant={currencyIssue ? 'error' : 'default'}
            {...formFieldAttributes(clientFormFields.billing_currency, currencyIssue)}
          />
          <datalist id="billing-currencies">
            {CURRENCIES.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.name}
              </option>
            ))}
          </datalist>
        </Field>
      </>
    );
  };
}

export const billingSection: ClientFormSection = {
  key: 'billing',
  title: 'Billing address',
  hint: 'Shown on invoices sent to this client.',
  render: (props) => (
    <BillingFields
      values={props.values}
      issues={props.issues}
    />
  ),
  parse(values) {
    // Only the billing fields this section owns; other sections fill in the rest.
    let parsed = parseClientBilling({
      billing_line1: values.billing_line1,
      billing_locality: values.billing_locality,
      billing_region: values.billing_region,
      billing_postal_code: values.billing_postal_code,
      billing_country: values.billing_country,
      billing_currency: values.billing_currency,
    });

    if (!parsed.ok) {
      return {
        changes: {},
        issues: parsed.issues.map((issue) => ({
          message: issue.message,
          path: [issue.field],
        })),
      };
    }

    return { changes: parsed.value, issues: [] };
  },
};
