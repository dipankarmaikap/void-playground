import type { Handle } from 'remix/component';
import { css } from 'remix/component';

import { avatarColors, fontStack } from './theme.ts';

export type AvatarTone = keyof typeof avatarColors;

const baseStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  borderRadius: '50%',
  fontFamily: fontStack,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '-0.01em',
});

const sizeStyles = {
  sm: css({ width: '29px', height: '29px', fontSize: '0.5625rem' }),
  lg: css({ width: '48px', height: '48px', fontSize: '0.875rem' }),
};

const toneStyles = {
  default: css({ background: avatarColors.default.background, color: avatarColors.default.color }),
  purple: css({ background: avatarColors.purple.background, color: avatarColors.purple.color }),
  blue: css({ background: avatarColors.blue.background, color: avatarColors.blue.color }),
  green: css({ background: avatarColors.green.background, color: avatarColors.green.color }),
  yellow: css({ background: avatarColors.yellow.background, color: avatarColors.yellow.color }),
};

const TONES: readonly AvatarTone[] = ['purple', 'blue', 'green', 'yellow', 'default'];

/** Up to two initials from a display name, uppercased. */
export function avatarInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0] ?? '')
      .join('') || '?'
  );
}

/** Stable hue per name, so a Client keeps the same avatar across renders. */
export function avatarToneFor(name: string): AvatarTone {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return TONES[hash % TONES.length] ?? 'default';
}

export interface AvatarProps {
  name: string;
  tone?: AvatarTone;
  size?: keyof typeof sizeStyles;
}

/** Decorative initials avatar; the adjacent link or text supplies the accessible name. */
export function Avatar(handle: Handle<AvatarProps>) {
  return () => {
    let { name, tone, size = 'sm' } = handle.props;
    return (
      <span
        aria-hidden="true"
        mix={[baseStyle, sizeStyles[size], toneStyles[tone ?? avatarToneFor(name)]]}
      >
        {avatarInitials(name)}
      </span>
    );
  };
}
