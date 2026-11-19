import * as assert from 'remix/assert';
import { describe, it } from 'remix/test';

import {
  avatarColors,
  colors,
  fontAssetHref,
  fontFamily,
  fontStack,
  focus,
  gradients,
  neutrals,
  primary,
  radius,
  radii,
  shadow,
  shadows,
  softFills,
  statusColors,
  typography,
} from './theme.ts';

const INTER_STACK = '"Inter", "Segoe UI", sans-serif';

describe('shared theme', () => {
  it('carries the reference neutrals and primary shades', () => {
    assert.deepEqual(neutrals, {
      ink: '#24243a',
      muted: '#77788e',
      softMuted: '#9b9caf',
      line: '#ececf3',
      paper: '#ffffff',
      canvas: '#f7f7fb',
    });

    assert.deepEqual(primary, {
      base: '#3d5fd3',
      dark: '#2f4db2',
      soft: '#eef3ff',
      mid: '#d6e2ff',
      coral: '#ff806f',
      mint: '#dff4e9',
      green: '#24845c',
      amber: '#b87918',
      red: '#c94b4b',
    });
  });

  it('carries the semantic status and avatar colour pairs', () => {
    assert.deepEqual(statusColors, {
      paid: { background: '#e7f6ef', color: '#27845d' },
      sent: { background: '#edf2ff', color: '#3e5eb9' },
      draft: { background: '#f0f0f4', color: '#737487' },
      overdue: { background: '#fff0ed', color: '#d05b4c' },
      pending: { background: '#fff6e5', color: '#a97219' },
    });

    assert.deepEqual(avatarColors, {
      default: { background: '#f5d9cb', color: '#91583f' },
      purple: { background: '#e0e9ff', color: '#3858b7' },
      blue: { background: '#dceefe', color: '#477da8' },
      green: { background: '#daf0e4', color: '#35815b' },
      yellow: { background: '#fff0cc', color: '#a57c29' },
    });

    assert.deepEqual(softFills.navBadge, { background: '#fff0ec', color: '#d86e5c' });
    assert.deepEqual(softFills.workspaceAvatar, { background: '#fff0e9', color: '#cc6b4f' });
    assert.equal(softFills.trendUp, '#27845c');
    assert.equal(softFills.trendDown, '#d26b5a');
  });

  it('carries the effective radii, shadows, gradients and focus ring', () => {
    assert.deepEqual(radii, {
      xs: '4px',
      sm: '6px',
      md: '7px',
      lg: '8px',
      xl: '9px',
      panel: '10px',
      feature: '12px',
      illustration: '14px',
    });

    assert.deepEqual(shadows, {
      large: '0 18px 48px rgba(42, 39, 92, 0.08)',
      small: '0 5px 20px rgba(42, 39, 92, 0.06)',
      panel: '0 2px 8px rgba(39, 36, 87, 0.015)',
      primary: '0 7px 15px rgba(61, 95, 211, 0.2)',
      brandMark: '0 5px 12px rgba(55, 86, 190, 0.2)',
    });

    assert.deepEqual(gradients, {
      brandMark: 'linear-gradient(145deg, #6f8bea 0%, #3658c5 80%)',
      helpCard: 'linear-gradient(135deg, #eff3ff, #f8faff)',
      cta: 'linear-gradient(130deg, #3657c2, #5275dc)',
    });

    assert.deepEqual(focus, { outline: '3px solid rgba(61, 95, 211, 0.24)', offset: '2px' });
  });

  it('exposes one Inter font stack for every consumer', () => {
    assert.equal(fontStack, INTER_STACK);
    assert.equal(fontFamily, INTER_STACK);
    assert.equal(fontAssetHref, '/fonts/inter-latin.woff2');
    assert.equal(typography.bodyFontSize, '16px');
    assert.equal(typography.bodyLineHeight, 1.55);
  });

  it('keeps the legacy token names pointing at the reference palette', () => {
    assert.equal(colors.background, neutrals.canvas);
    assert.equal(colors.surface, neutrals.paper);
    assert.equal(colors.text, neutrals.ink);
    assert.equal(colors.muted, neutrals.muted);
    assert.equal(colors.border, neutrals.line);
    assert.equal(colors.accent, primary.base);
    assert.equal(colors.accentHover, primary.dark);
    assert.equal(colors.accentSoft, primary.soft);
    assert.equal(colors.onPrimary, neutrals.paper);
    assert.equal(colors.danger, primary.red);
    assert.equal(colors.success, primary.green);
    assert.equal(radius.md, '8px');
    assert.equal(radius.lg, '10px');
    assert.equal(shadow.card, shadows.small);
  });
});
