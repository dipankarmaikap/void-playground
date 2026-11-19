import type { Handle } from 'remix/component';
import { css } from 'remix/component';
import type { Issue } from 'remix/data-schema';

import { Button } from '../../../ui/button.tsx';
import {
  formStackStyle,
  noticeErrorStyle,
  noticeSpacingStyle,
} from '../../../ui/page-styles.ts';
import { RestfulForm } from '../../../ui/public/restful-form.tsx';
import type { ClientFormValues } from './form-values.ts';
import { clientFormSections } from './sections/registry.ts';

export interface ClientFormProps {
  csrfToken: string;
  action: string;
  method?: 'POST' | 'PUT';
  submitLabel: string;
  values: ClientFormValues;
  issues?: readonly Issue[];
}

const sectionStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
});

export function ClientForm(handle: Handle<ClientFormProps>) {
  return () => {
    let { csrfToken, action, method = 'POST', submitLabel, values, issues = [] } = handle.props;

    return (
      <RestfulForm method={method} action={action} mix={formStackStyle}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        {issues.length > 0 ? (
          <p role="alert" mix={[noticeErrorStyle, noticeSpacingStyle]}>
            Please correct the fields below.
          </p>
        ) : null}
        {clientFormSections.map((section) => (
          <div key={section.key} mix={sectionStyle}>
            {section.render({ values, issues })}
          </div>
        ))}
        <div>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </RestfulForm>
    );
  };
}
