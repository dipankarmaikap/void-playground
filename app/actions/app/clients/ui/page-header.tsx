import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import { fontStack, neutrals, primary } from '../../../../ui/theme.ts';

/** Shared reference-style eyebrow + heading + introduction used by authenticated pages. */
export interface PageHeaderProps {
  eyebrow: string;
  title: string;
  intro: string;
  action?: RemixNode;
}

// The header's action row, named for its own context so the exported `pageHeaderStyle`
// keeps exactly one meaning.
const headerRowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '1rem',
  marginBottom: '1.5rem',
});

const eyebrowStyle = css({
  display: 'block',
  marginBottom: '4px',
  color: primary.base,
  fontSize: '0.8125rem',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
});

const headingStyle = css({
  margin: 0,
  color: neutrals.ink,
  fontFamily: fontStack,
  fontSize: '2rem',
  fontWeight: 800,
  letterSpacing: '-0.02em',
  lineHeight: 1.2,
  '@media (max-width: 51.25rem)': {
    fontSize: '1.6875rem',
  },
});

const introStyle = css({
  margin: '6px 0 0',
  color: neutrals.muted,
  fontSize: '0.9375rem',
  lineHeight: 1.55,
});

export function PageHeader(handle: Handle<PageHeaderProps>) {
  return () => {
    let { eyebrow, title, intro, action } = handle.props;
    return (
      <header mix={headerRowStyle}>
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
