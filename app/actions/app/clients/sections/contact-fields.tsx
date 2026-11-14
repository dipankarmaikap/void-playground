import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { parseClientContacts } from '../../../../data/client-contacts.ts';
import { Field } from '../../../../ui/field.tsx';
import { Input } from '../../../../ui/input.tsx';
import { issueFor, readText } from '../form-values.ts';
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

    return (
      <>
        <Field
          label="Email"
          hint="Optional. Format is checked, not verified."
          error={emailIssue?.message}
        >
          <Input
            name="email"
            type="email"
            defaultValue={values.email}
            aria-invalid={emailIssue ? true : undefined}
            variant={errorVariant(emailIssue)}
          />
        </Field>
        <Field
          label="Phone"
          hint="Optional. International numbers are welcome."
          error={phoneIssue?.message}
        >
          <Input
            name="phone"
            type="tel"
            defaultValue={values.phone}
            aria-invalid={phoneIssue ? true : undefined}
            variant={errorVariant(phoneIssue)}
          />
        </Field>
        {/* The primary-contact group is business-only, but stays in the form while hidden
            so a type change preserves its values. */}
        <fieldset hidden={!isBusiness} mix={contactGroupStyle}>
          <legend mix={legendStyle}>Primary contact</legend>
          <Field
            label="Contact name"
            hint="Required when you add any other primary contact detail."
            error={contactNameIssue?.message}
          >
            <Input
              name="contact_name"
              defaultValue={values.contact_name}
              aria-invalid={contactNameIssue ? true : undefined}
              variant={errorVariant(contactNameIssue)}
            />
          </Field>
          <Field label="Role" hint="Optional." error={contactRoleIssue?.message}>
            <Input
              name="contact_role"
              defaultValue={values.contact_role}
              aria-invalid={contactRoleIssue ? true : undefined}
              variant={errorVariant(contactRoleIssue)}
            />
          </Field>
          <Field label="Contact email" hint="Optional." error={contactEmailIssue?.message}>
            <Input
              name="contact_email"
              type="email"
              defaultValue={values.contact_email}
              aria-invalid={contactEmailIssue ? true : undefined}
              variant={errorVariant(contactEmailIssue)}
            />
          </Field>
          <Field label="Contact phone" hint="Optional." error={contactPhoneIssue?.message}>
            <Input
              name="contact_phone"
              type="tel"
              defaultValue={values.contact_phone}
              aria-invalid={contactPhoneIssue ? true : undefined}
              variant={errorVariant(contactPhoneIssue)}
            />
          </Field>
        </fieldset>
      </>
    );
  };
}

export const contactSection: ClientFormSection = {
  key: 'contacts',
  render: (props) => <ContactFields values={props.values} issues={props.issues} />,
  parse(formData) {
    let parsed = parseClientContacts({
      email: readText(formData, 'email'),
      phone: readText(formData, 'phone'),
      contact_name: readText(formData, 'contact_name'),
      contact_role: readText(formData, 'contact_role'),
      contact_email: readText(formData, 'contact_email'),
      contact_phone: readText(formData, 'contact_phone'),
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
