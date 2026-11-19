import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import {
  CLIENT_TYPES,
  clientTypeLabel,
  parseClientNames,
} from '../../../../data/client-names.ts';
import { validateClientTextFields } from '../../../../data/client-text.ts';
import { Field } from '../../../../ui/field.tsx';
import { Input } from '../../../../ui/input.tsx';
import { formFieldAttributes } from '../../../../ui/public/form-field.ts';
import { Select } from '../../../../ui/select.tsx';
import { issueFor } from '../form-values.ts';
import { clientFormFields } from '../public/schema.ts';
import type { ClientFormSection, ClientFormSectionProps } from './registry.ts';

const nameGroupStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
});

export function ProfileFields(handle: Handle<ClientFormSectionProps>) {
  return () => {
    let { values, issues } = handle.props;
    let typeIssue = issueFor(issues, 'type');
    let legalNameIssue = issueFor(issues, 'legal_name');
    let preferredNameIssue = issueFor(issues, 'preferred_name');
    let tradingNameIssue = issueFor(issues, 'trading_name');
    let industryIssue = issueFor(issues, 'industry');
    let isBusiness = values.type === 'business';
    let showIndividualNameGroup = !isBusiness || Boolean(preferredNameIssue);
    let showBusinessNameGroup =
      isBusiness || Boolean(tradingNameIssue || industryIssue);

    return (
      <>
        <Field label="Client type" error={typeIssue?.message}>
          <Select
            name="type"
            variant={typeIssue ? 'error' : 'default'}
            {...formFieldAttributes(clientFormFields.type, typeIssue)}
          >
            <option value="">Select a type</option>
            {CLIENT_TYPES.map((type) => (
              <option key={type} value={type} selected={values.type === type}>
                {clientTypeLabel(type)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Legal name"
          hint="The name that identifies this client on records."
          error={legalNameIssue?.message}
        >
          <Input
            name="legal_name"
            defaultValue={values.legal_name}
            variant={legalNameIssue ? 'error' : 'default'}
            {...formFieldAttributes(clientFormFields.legal_name, legalNameIssue)}
          />
        </Field>
        {/* Both type-specific groups stay in the form; hidden values still submit. */}
        <div hidden={!showIndividualNameGroup} mix={nameGroupStyle}>
          <Field
            label="Preferred name"
            hint="Optional. Shown before the legal name in lists."
            error={preferredNameIssue?.message}
          >
            <Input
              name="preferred_name"
              defaultValue={values.preferred_name}
              variant={preferredNameIssue ? 'error' : 'default'}
              {...formFieldAttributes(clientFormFields.preferred_name, preferredNameIssue)}
            />
          </Field>
        </div>
        <div hidden={!showBusinessNameGroup} mix={nameGroupStyle}>
          <Field
            label="Trading name"
            hint="Optional. Shown before the legal name in lists."
            error={tradingNameIssue?.message}
          >
            <Input
              name="trading_name"
              defaultValue={values.trading_name}
              variant={tradingNameIssue ? 'error' : 'default'}
              {...formFieldAttributes(clientFormFields.trading_name, tradingNameIssue)}
            />
          </Field>
          <Field
            label="Industry"
            hint="Optional. Describe the line of work in your own words."
            error={industryIssue?.message}
          >
            <Input
              name="industry"
              defaultValue={values.industry}
              variant={industryIssue ? 'error' : 'default'}
              {...formFieldAttributes(clientFormFields.industry, industryIssue)}
            />
          </Field>
        </div>
      </>
    );
  };
}

export const profileSection: ClientFormSection = {
  key: 'profile',
  title: 'Client details',
  hint: 'Tell us who you will be working with.',
  render: (props) => (
    <ProfileFields
      values={props.values}
      issues={props.issues}
    />
  ),
  parse(values) {
    let industryIssues = validateClientTextFields({ industry: values.industry });
    let parsed = parseClientNames({
      type: values.type,
      legal_name: values.legal_name,
      preferred_name: values.preferred_name,
      trading_name: values.trading_name,
    });

    if (!parsed.ok || industryIssues.length > 0) {
      return {
        changes: {},
        issues: [
          ...(parsed.ok
            ? []
            : parsed.issues.map((issue) => ({
                message: issue.message,
                path: [issue.field],
              }))),
          ...industryIssues.map((issue) => ({
            message: issue.message,
            path: [issue.field],
          })),
        ],
      };
    }

    return {
      changes: { ...parsed.value, industry: values.industry.trim() || null },
      issues: [],
    };
  },
};
