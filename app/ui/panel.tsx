import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import { neutrals, radii, shadows } from './theme.ts';

export const panelStyle = css({
  overflow: 'hidden',
  border: `1px solid ${neutrals.line}`,
  borderRadius: radii.panel,
  background: neutrals.paper,
  boxShadow: shadows.panel,
});

export const panelHeaderStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '18px 19px 0',
});

export const panelTitleStyle = css({
  margin: 0,
  color: neutrals.ink,
  fontSize: '1.0625rem',
  fontWeight: 700,
  letterSpacing: '-0.01em',
});

export const panelSubtitleStyle = css({
  margin: '4px 0 0',
  color: neutrals.muted,
  fontSize: '0.8125rem',
});

export const panelActionStyle = css({
  color: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: 600,
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
});

export const panelBodyStyle = css({
  padding: '16px 19px 19px',
});

export const panelFooterStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '13px 17px',
  borderTop: `1px solid ${neutrals.line}`,
  color: neutrals.softMuted,
  fontSize: '0.75rem',
});

export interface PanelProps {
  children: RemixNode;
  /** Id of the heading that labels this panel for assistive technology. */
  labelledBy?: string;
}

/** A bordered surface for a related group of page content. */
export function Panel(handle: Handle<PanelProps>) {
  return () => (
    <section aria-labelledby={handle.props.labelledBy} mix={panelStyle}>
      {handle.props.children}
    </section>
  );
}

export interface PanelHeaderProps {
  title: string;
  headingId: string;
  subtitle?: string;
  action?: RemixNode;
}

export function PanelHeader(handle: Handle<PanelHeaderProps>) {
  return () => {
    let { title, headingId, subtitle, action } = handle.props;
    return (
      <div mix={panelHeaderStyle}>
        <div>
          <h2 id={headingId} mix={panelTitleStyle}>
            {title}
          </h2>
          {subtitle ? <p mix={panelSubtitleStyle}>{subtitle}</p> : null}
        </div>
        {action}
      </div>
    );
  };
}

export interface PanelSectionProps {
  children: RemixNode;
}

export function PanelBody(handle: Handle<PanelSectionProps>) {
  return () => <div mix={panelBodyStyle}>{handle.props.children}</div>;
}

export function PanelFooter(handle: Handle<PanelSectionProps>) {
  return () => <div mix={panelFooterStyle}>{handle.props.children}</div>;
}
