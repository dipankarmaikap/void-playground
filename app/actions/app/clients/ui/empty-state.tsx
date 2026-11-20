import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import { neutrals } from '../../../../ui/theme.ts';

const emptyStateStyle = css({
  display: 'grid',
  gap: '6px',
  justifyItems: 'start',
  padding: '28px 0',
  color: neutrals.muted,
  fontSize: '0.875rem',
});

const emptyHeadingStyle = css({
  margin: 0,
  color: neutrals.ink,
  fontSize: '0.9375rem',
  fontWeight: 700,
});

const emptyHintStyle = css({
  margin: 0,
  color: neutrals.muted,
  fontSize: '0.8125rem',
});

/**
 * The shared "nothing here yet" block for Clients pages. The two directory variants
 * (heading + hint, plus an optional reset link) previously drifted between copies;
 * composing them here keeps one definition of the empty-state voice.
 */
export function EmptyState(handle: Handle<{ children: RemixNode }>) {
  return () => <div mix={emptyStateStyle}>{handle.props.children}</div>;
}

export namespace EmptyState {
  /** The bold line that names what is empty. */
  export function Heading(handle: Handle<{ children: RemixNode }>) {
    return () => <p mix={emptyHeadingStyle}>{handle.props.children}</p>;
  }

  /** The quieter line that explains what will fill the space. */
  export function Hint(handle: Handle<{ children: RemixNode }>) {
    return () => <p mix={emptyHintStyle}>{handle.props.children}</p>;
  }
}
