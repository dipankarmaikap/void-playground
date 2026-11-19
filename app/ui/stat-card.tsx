import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import { fontStack, neutrals, primary, radii, shadows, softFills } from './theme.ts';

export type StatCardTone = 'primary' | 'coral' | 'green' | 'amber';

/** The responsive grid that groups summary cards on both directory and profile pages. */
export const statGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '14px',
  marginBottom: '18px',
});

export const statCardStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '17px 18px 16px',
  border: `1px solid ${neutrals.line}`,
  borderRadius: radii.panel,
  background: neutrals.paper,
  boxShadow: shadows.panel,
});

const toplineStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
});

const labelStyle = css({
  color: neutrals.muted,
  fontSize: '0.8125rem',
  fontWeight: 600,
});

const valueStyle = css({
  color: neutrals.ink,
  fontFamily: fontStack,
  fontSize: 'clamp(1.5625rem, 2.5vw, 1.9375rem)',
  fontWeight: 800,
  letterSpacing: '-0.035em',
  lineHeight: 1.15,
  '@media (max-width: 51.25rem)': {
    fontSize: '1.5rem',
  },
});

const footStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.35rem',
  color: neutrals.softMuted,
  fontSize: '0.75rem',
});

const iconBaseStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: radii.xl,
  background: primary.soft,
  color: primary.base,
  fontSize: '0.875rem',
  fontWeight: 700,
  flexShrink: 0,
  '&[data-tone="coral"]': {
    background: softFills.coral.background,
    color: softFills.coral.color,
  },
  '&[data-tone="green"]': {
    background: softFills.green.background,
    color: softFills.green.color,
  },
  '&[data-tone="amber"]': {
    background: softFills.amber.background,
    color: softFills.amber.color,
  },
});

export const trendUpStyle = css({ color: softFills.trendUp, fontWeight: 700 });
export const trendDownStyle = css({ color: softFills.trendDown, fontWeight: 700 });

export interface StatCardProps {
  label: string;
  value: string;
  icon?: string;
  tone?: StatCardTone;
  foot?: RemixNode;
}

/** One summary metric in the reference card grid. */
export function StatCard(handle: Handle<StatCardProps>) {
  return () => {
    let { label, value, icon, tone = 'primary', foot } = handle.props;
    return (
      <article mix={statCardStyle}>
        <div mix={toplineStyle}>
          <span mix={labelStyle}>{label}</span>
          {icon ? (
            <span aria-hidden="true" data-tone={tone} mix={iconBaseStyle}>
              {icon}
            </span>
          ) : null}
        </div>
        <div mix={valueStyle}>{value}</div>
        {foot ? <div mix={footStyle}>{foot}</div> : null}
      </article>
    );
  };
}
