import type { Handle } from 'remix/component';
import { css } from 'remix/component';
import type { Issue } from 'remix/data-schema';

import { Button, linkButtonStyle } from '../../../ui/button.tsx';
import {
  panelFooterStyle,
  panelStyle,
  panelSubtitleStyle,
  panelTitleStyle,
} from './ui/panel.tsx';
import { noticeErrorStyle, noticeSpacingStyle } from '../../../ui/page-styles.ts';
import { RestfulForm } from '../../../ui/public/restful-form.tsx';
import { neutrals } from '../../../ui/theme.ts';
import type { ClientFormValues } from './form-values.ts';
import { clientFormSections } from './sections/registry.ts';

export interface ClientFormProps {
  csrfToken: string;
  action: string;
  method?: 'POST' | 'PUT';
  submitLabel: string;
  cancelHref: string;
  values: ClientFormValues;
  issues?: readonly Issue[];
}

const formPanelStyle = css({
  display: 'flex',
  flexDirection: 'column',
});

const noticeWrapStyle = css({
  padding: '14px 19px 0',
});

const formSectionStyle = css({
  padding: '18px 19px',
  borderBottom: `1px solid ${neutrals.line}`,
});

const formGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: '14px',
  marginTop: '14px',
  '@media (min-width: 48rem)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  // Multi-field groups render as one block so their inner labels stay together.
  '& > div, & > fieldset': {
    gridColumn: '1 / -1',
  },
});

const actionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.75rem',
});

export function ClientForm(handle: Handle<ClientFormProps>) {
  return () => {
    let {
      csrfToken,
      action,
      method = 'POST',
      submitLabel,
      cancelHref,
      values,
      issues = [],
    } = handle.props;

    return (
      <RestfulForm method={method} action={action} mix={[panelStyle, formPanelStyle]}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        {issues.length > 0 ? (
          <div mix={noticeWrapStyle}>
            <p role="alert" mix={[noticeErrorStyle, noticeSpacingStyle]}>
              Please correct the fields below.
            </p>
          </div>
        ) : null}
        {clientFormSections.map((section) => (
          <section key={section.key} mix={formSectionStyle}>
            <h2 mix={panelTitleStyle}>{section.title}</h2>
            <p mix={panelSubtitleStyle}>{section.hint}</p>
            <div mix={formGridStyle}>{section.render({ values, issues })}</div>
          </section>
        ))}
        <div mix={panelFooterStyle}>
          <div mix={actionsStyle}>
            <a href={cancelHref} data-variant="secondary" mix={linkButtonStyle}>
              Cancel
            </a>
            <Button type="submit">{submitLabel}</Button>
          </div>
        </div>
      </RestfulForm>
    );
  };
}
