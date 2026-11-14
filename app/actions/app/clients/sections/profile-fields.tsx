import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import {
  CLIENT_NAME_MAX_LENGTH,
  CLIENT_TYPES,
  clientTypeLabel,
  parseClientNames,
} from '../../../../data/client-names.ts';
import { validateClientTextFields, CLIENT_TEXT_LIMITS } from '../../../../data/client-text.ts';
import { Field } from '../../../../ui/field.tsx';
import { Input } from '../../../../ui/input.tsx';
import { Select } from '../../../../ui/select.tsx';
import { issueFor, readText } from '../form-values.ts';
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

    return (
      <>
        <Field label="Client type" error={typeIssue?.message}>
          <Select
            name="type"
            required
            aria-invalid={typeIssue ? true : undefined}
            variant={typeIssue ? 'error' : 'default'}
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
            required
            maxLength={CLIENT_NAME_MAX_LENGTH}
            defaultValue={values.legal_name}
            aria-invalid={legalNameIssue ? true : undefined}
            variant={legalNameIssue ? 'error' : 'default'}
          />
        </Field>
        {/* Both type-specific groups stay in the form; hidden values still submit. */}
        <div hidden={isBusiness} mix={nameGroupStyle}>
          <Field
            label="Preferred name"
            hint="Optional. Shown before the legal name in lists."
            error={preferredNameIssue?.message}
          >
            <Input
              name="preferred_name"
              maxLength={CLIENT_NAME_MAX_LENGTH}
              defaultValue={values.preferred_name}
              aria-invalid={preferredNameIssue ? true : undefined}
              variant={preferredNameIssue ? 'error' : 'default'}
            />
          </Field>
        </div>
        <div hidden={!isBusiness} mix={nameGroupStyle}>
          <Field
            label="Trading name"
            hint="Optional. Shown before the legal name in lists."
            error={tradingNameIssue?.message}
          >
            <Input
              name="trading_name"
              maxLength={CLIENT_NAME_MAX_LENGTH}
              defaultValue={values.trading_name}
              aria-invalid={tradingNameIssue ? true : undefined}
              variant={tradingNameIssue ? 'error' : 'default'}
            />
          </Field>
          <Field
            label="Industry"
            hint="Optional. Describe the line of work in your own words."
            error={industryIssue?.message}
          >
            <Input
              name="industry"
              maxLength={CLIENT_TEXT_LIMITS.industry}
              defaultValue={values.industry}
              aria-invalid={industryIssue ? true : undefined}
              variant={industryIssue ? 'error' : 'default'}
            />
          </Field>
        </div>
      </>
    );
  };
}

export const profileSection: ClientFormSection = {
  key: 'profile',
  render: (props) => <ProfileFields values={props.values} issues={props.issues} />,
  parse(formData) {
    let type = readText(formData, 'type');
    let legalName = readText(formData, 'legal_name');
    let industry = readText(formData, 'industry');
    let industryIssues = validateClientTextFields({ industry });
    let parsed = parseClientNames({
      type,
      legal_name: legalName,
      preferred_name: readText(formData, 'preferred_name'),
      trading_name: readText(formData, 'trading_name'),
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
      changes: { ...parsed.value, industry: industry.trim() || null },
      issues: [],
    };
  },
};
