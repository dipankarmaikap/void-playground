import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import type { Client } from '../../../../data/db.ts';
import { routes } from '../../../../routes.ts';
import { Button } from '../../../../ui/button.tsx';
import { Icon } from '../../../../ui/icon.tsx';
import { colors } from '../../../../ui/theme.ts';
import { RestfulForm } from '../../../../ui/public/restful-form.tsx';

export interface ClientStatusControlsProps {
  csrfToken: string;
  client: Client;
}

const groupStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.375rem',
  maxWidth: '26rem',
});

const formStyle = css({
  display: 'flex',
});

const noteStyle = css({
  margin: 0,
  color: colors.muted,
  fontSize: '0.8125rem',
  lineHeight: 1.5,
});

/**
 * The Archive/Restore control for one Client profile.
 *
 * Archiving is reversible, so it is a secondary action; restoring is the primary action
 * once a Client is archived. Each state renders its own CSRF-protected form.
 */
export function ClientStatusControls(handle: Handle<ClientStatusControlsProps>) {
  return () => {
    let { csrfToken, client } = handle.props;
    let archived = client.status === 'archived';
    let action = archived
      ? routes.app.clients.lifecycle.restore.href({ clientId: client.id })
      : routes.app.clients.lifecycle.archive.href({ clientId: client.id });

    return (
      <div mix={groupStyle}>
        <RestfulForm method="PUT" action={action} mix={formStyle}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <Button variant={archived ? 'primary' : 'secondary'}>
            <Icon name="archive" />
            <span>{archived ? 'Restore client' : 'Archive client'}</span>
          </Button>
        </RestfulForm>
        <p mix={noteStyle}>
          {archived
            ? 'Restoring returns this client to the active directory.'
            : 'Archiving keeps every detail and hides this client from the active directory.'}
        </p>
      </div>
    );
  };
}
