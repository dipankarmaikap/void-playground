import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import { APP_NAME } from '../config.ts';
import { routes } from '../routes.ts';
import { publicScreenStyle } from './page-styles.ts';
import { colors, radius, shadow } from './theme.ts';

export interface AuthLayoutProps {
  children: RemixNode;
}

const cardStyle = css({
  width: '100%',
  maxWidth: '26rem',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
  padding: '2rem',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  boxShadow: shadow.card,
});

const brandStyle = css({
  alignSelf: 'flex-start',
  color: colors.accent,
  fontSize: '0.875rem',
  fontWeight: 700,
  letterSpacing: '0.02em',
  textDecoration: 'none',
  '&:hover': {
    color: colors.accentHover,
  },
});

export function AuthLayout(handle: Handle<AuthLayoutProps>) {
  return () => (
    <main mix={publicScreenStyle}>
      <div mix={cardStyle}>
        <a href={routes.home.href()} mix={brandStyle}>
          {APP_NAME}
        </a>
        {handle.props.children}
      </div>
    </main>
  );
}
