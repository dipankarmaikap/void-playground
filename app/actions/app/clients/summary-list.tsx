import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import { Panel, PanelBody, PanelHeader } from '../../../ui/panel.tsx';
import { neutrals } from '../../../ui/theme.ts';

/**
 * Route-local composition of the shared Panel primitives for the Client profile's read-only
 * detail cards. Keeping it here avoids repeating card/list/term styles in each summary.
 */
export interface SummaryPanelProps {
  title: string;
  headingId: string;
  subtitle?: string;
  children: RemixNode;
}

export function SummaryPanel(handle: Handle<SummaryPanelProps>) {
  return () => {
    let { title, headingId, subtitle, children } = handle.props;
    return (
      <Panel labelledBy={headingId}>
        <PanelHeader title={title} headingId={headingId} subtitle={subtitle} />
        <PanelBody>{children}</PanelBody>
      </Panel>
    );
  };
}

const listStyle = css({
  display: 'grid',
  gap: '0.75rem',
  margin: 0,
});

const termStyle = css({
  color: neutrals.muted,
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
});

const detailStyle = css({
  margin: '0.125rem 0 0',
  color: neutrals.ink,
  fontSize: '0.8125rem',
  overflowWrap: 'anywhere',
});

const emptyStyle = css({
  margin: 0,
  color: neutrals.muted,
  fontSize: '0.8125rem',
});

export function SummaryList(handle: Handle<{ children: RemixNode }>) {
  return () => <dl mix={listStyle}>{handle.props.children}</dl>;
}

export interface SummaryRowProps {
  term: string;
  children: RemixNode;
}

export function SummaryRow(handle: Handle<SummaryRowProps>) {
  return () => {
    let { term, children } = handle.props;
    return (
      <div>
        <dt mix={termStyle}>{term}</dt>
        <dd mix={detailStyle}>{children}</dd>
      </div>
    );
  };
}

export function SummaryEmpty(handle: Handle<{ children: RemixNode }>) {
  return () => <p mix={emptyStyle}>{handle.props.children}</p>;
}
