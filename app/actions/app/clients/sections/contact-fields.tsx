import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { parseClientContacts } from '../../../../data/client-contacts.ts';
import { Field } from '../../../../ui/field.tsx';
import { Input } from '../../../../ui/input.tsx';
import { formFieldAttributes } from '../../../../ui/public/form-field.ts';
import { issueFor } from '../form-values.ts';
import { clientFormFields } from '../public/schema.ts';
import type { ClientFormSection, ClientFormSectionProps } from './registry.ts';

const contactGroupStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  margin: 0,
  padding: 0,
  border: 0,
});

const legendStyle = css({
  padding: 0,
  marginBottom: '0.25rem',
  fontSize: '0.9375rem',
  fontWeight: 700,
});

const errorVariant = (issue: unknown) => (issue ? 'error' : 'default');

export function ContactFields(handle: Handle<ClientFormSectionProps>) {
  return () => {
    let { values, issues } = handle.props;
    let emailIssue = issueFor(issues, 'email');
    let phoneIssue = issueFor(issues, 'phone');
    let contactNameIssue = issueFor(issues, 'contact_name');
    let contactRoleIssue = issueFor(issues, 'contact_role');
    let contactEmailIssue = issueFor(issues, 'contact_email');
    let contactPhoneIssue = issueFor(issues, 'contact_phone');
    let isBusiness = values.type === 'business';
    let hasPrimaryContactIssues = Boolean(
      contactNameIssue || contactRoleIssue || contactEmailIssue || contactPhoneIssue,
    );

    return (
      <>
        <Field
          label="Email"
          hint="Optional. Format is checked, not verified."
          error={emailIssue?.message}
        >
          <Input
            name="email"
            defaultValue={values.email}
            variant={errorVariant(emailIssue)}
            {...formFieldAttributes(clientFormFields.email, emailIssue)}
          />
        </Field>
        <Field
          label="Phone"
          hint="Optional. International numbers are welcome."
          error={phoneIssue?.message}
        >
          <Input
            name="phone"
            defaultValue={values.phone}
            variant={errorVariant(phoneIssue)}
            {...formFieldAttributes(clientFormFields.phone, phoneIssue)}
          />
        </Field>
        {/* The primary-contact group is business-only, but stays in the form while hidden
            so a type change preserves its values. */}
        <fieldset hidden={!isBusiness && !hasPrimaryContactIssues} mix={contactGroupStyle}>
          <legend mix={legendStyle}>Primary contact</legend>
          <Field
            label="Contact name"
            hint="Required when you add any other primary contact detail."
            error={contactNameIssue?.message}
          >
            <Input
              name="contact_name"
              defaultValue={values.contact_name}
              variant={errorVariant(contactNameIssue)}
              {...formFieldAttributes(clientFormFields.contact_name, contactNameIssue)}
            />
          </Field>
          <Field label="Role" hint="Optional." error={contactRoleIssue?.message}>
            <Input
              name="contact_role"
              defaultValue={values.contact_role}
              variant={errorVariant(contactRoleIssue)}
              {...formFieldAttributes(clientFormFields.contact_role, contactRoleIssue)}
            />
          </Field>
          <Field label="Contact email" hint="Optional." error={contactEmailIssue?.message}>
            <Input
              name="contact_email"
              defaultValue={values.contact_email}
              variant={errorVariant(contactEmailIssue)}
              {...formFieldAttributes(clientFormFields.contact_email, contactEmailIssue)}
            />
          </Field>
          <Field label="Contact phone" hint="Optional." error={contactPhoneIssue?.message}>
            <Input
              name="contact_phone"
              defaultValue={values.contact_phone}
              variant={errorVariant(contactPhoneIssue)}
              {...formFieldAttributes(clientFormFields.contact_phone, contactPhoneIssue)}
            />
          </Field>
        </fieldset>
      </>
    );
  };
}

export const contactSection: ClientFormSection = {
  key: 'contacts',
  title: 'Contact details',
  hint: 'The best ways to reach this client.',
  render: (props) => (
    <ContactFields
      values={props.values}
      issues={props.issues}
    />
  ),
  parse(values) {
    let parsed = parseClientContacts({
      email: values.email,
      phone: values.phone,
      contact_name: values.contact_name,
      contact_role: values.contact_role,
      contact_email: values.contact_email,
      contact_phone: values.contact_phone,
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
