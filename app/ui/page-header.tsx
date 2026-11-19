import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import { fontStack, neutrals, primary } from './theme.ts';

/** Shared reference-style eyebrow + heading + introduction used by authenticated pages. */
export interface PageHeaderProps {
  eyebrow: string;
  title: string;
  intro: string;
  action?: RemixNode;
}

export const pageHeaderStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '1rem',
  marginBottom: '1.5rem',
});

export const eyebrowStyle = css({
  display: 'block',
  marginBottom: '4px',
  color: primary.base,
  fontSize: '0.6875rem',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
});

export const headingStyle = css({
  margin: 0,
  color: neutrals.ink,
  fontFamily: fontStack,
  fontSize: '1.625rem',
  fontWeight: 800,
  letterSpacing: '-0.02em',
  lineHeight: 1.2,
});

export const introStyle = css({
  margin: '6px 0 0',
  color: neutrals.muted,
  fontSize: '0.875rem',
  lineHeight: 1.55,
});

export function PageHeader(handle: Handle<PageHeaderProps>) {
  return () => {
    let { eyebrow, title, intro, action } = handle.props;
    return (
      <header mix={pageHeaderStyle}>
        <div>
          <span mix={eyebrowStyle}>{eyebrow}</span>
          <h1 mix={headingStyle}>{title}</h1>
          <p mix={introStyle}>{intro}</p>
        </div>
        {action}
      </header>
    );
  };
}
