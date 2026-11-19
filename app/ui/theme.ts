/**
 * Hisab Khata design tokens — the single managed source of truth.
 *
 * The values below are the canonical tokens from the reference stylesheet.
 * Every page reads its brand colour, radius, shadow and type from here; no
 * component should declare its own brand hex colour or font family.
 */

/** Neutral surfaces and ink (reference `--ink` … `--canvas`). */
export const neutrals = {
  ink: '#24243a',
  muted: '#77788e',
  softMuted: '#9b9caf',
  line: '#ececf3',
  paper: '#ffffff',
  canvas: '#f7f7fb',
} as const;

/** Primary brand shades and soft fills (reference `--purple` … `--red`). */
export const primary = {
  base: '#3d5fd3',
  dark: '#2f4db2',
  soft: '#eef3ff',
  mid: '#d6e2ff',
  coral: '#ff806f',
  mint: '#dff4e9',
  green: '#24845c',
  amber: '#b87918',
  red: '#c94b4b',
} as const;

/** Status pill background / ink pairs (reference `.status-*`). */
export const statusColors = {
  paid: { background: '#e7f6ef', color: '#27845d' },
  sent: { background: '#edf2ff', color: '#3e5eb9' },
  draft: { background: '#f0f0f4', color: '#737487' },
  overdue: { background: '#fff0ed', color: '#d05b4c' },
  pending: { background: '#fff6e5', color: '#a97219' },
} as const;

/** Initial-avatar background / ink pairs (reference `.avatar*`). */
export const avatarColors = {
  default: { background: '#f5d9cb', color: '#91583f' },
  purple: { background: '#e0e9ff', color: '#3858b7' },
  blue: { background: '#dceefe', color: '#477da8' },
  green: { background: '#daf0e4', color: '#35815b' },
  yellow: { background: '#fff0cc', color: '#a57c29' },
} as const;

/** Other reference soft fills, borders and trend colours. */
export const softFills = {
  navBadge: { background: '#fff0ec', color: '#d86e5c' },
  workspaceAvatar: { background: '#fff0e9', color: '#cc6b4f' },
  coral: { background: '#fff0ec', color: '#e57967' },
  green: { background: '#e9f7ef', color: '#32835d' },
  amber: { background: '#fff5e2', color: '#b47c24' },
  filterPill: { background: '#eef3ff', border: '#e8e5ff' },
  trendUp: '#27845c',
  trendDown: '#d26b5a',
} as const;

/** Effective radii after the reference's "keep the interface crisp" overrides. */
export const radii = {
  xs: '4px',
  sm: '6px',
  md: '7px',
  lg: '8px',
  xl: '9px',
  panel: '10px',
  feature: '12px',
  illustration: '14px',
} as const;

/** Reference shadows, from the subtle panel lift to the largest elevation. */
export const shadows = {
  large: '0 18px 48px rgba(42, 39, 92, 0.08)',
  small: '0 5px 20px rgba(42, 39, 92, 0.06)',
  panel: '0 2px 8px rgba(39, 36, 87, 0.015)',
  primary: '0 7px 15px rgba(61, 95, 211, 0.2)',
  brandMark: '0 5px 12px rgba(55, 86, 190, 0.2)',
} as const;

/** Reference gradients for the brand mark, help card and primary CTA. */
export const gradients = {
  brandMark: 'linear-gradient(145deg, #6f8bea 0%, #3658c5 80%)',
  helpCard: 'linear-gradient(135deg, #eff3ff, #f8faff)',
  cta: 'linear-gradient(130deg, #3657c2, #5275dc)',
} as const;

/** Keyboard focus treatment (reference `:focus-visible`). */
export const focus = {
  outline: '3px solid rgba(61, 95, 211, 0.24)',
  offset: '2px',
} as const;

/** Inter is shipped as a local static asset; this is its same-origin URL. */
export const fontAssetHref = '/fonts/inter-latin.woff2';

/** The single font stack used by the document, form controls and headings. */
export const fontStack = '"Inter", "Segoe UI", sans-serif';

/** Body and heading metrics from the reference. */
export const typography = {
  fontStack,
  bodyFontSize: '16px',
  bodyLineHeight: 1.55,
  minWidth: '320px',
  headingLetterSpacing: '-0.02em',
} as const;

/**
 * Backward-compatible aliases: long-standing consumers keep their names while
 * every value resolves to the reference palette above.
 */
export const colors = {
  background: neutrals.canvas,
  surface: neutrals.paper,
  text: neutrals.ink,
  muted: neutrals.muted,
  softMuted: neutrals.softMuted,
  border: neutrals.line,
  accent: primary.base,
  accentHover: primary.dark,
  accentSoft: primary.soft,
  accentMid: primary.mid,
  danger: primary.red,
  dangerSoft: statusColors.overdue.background,
  // The reference does not define a danger hover, so keep the established
  // shade here rather than in the component that uses it.
  dangerHover: '#991b1b',
  success: primary.green,
  successSoft: statusColors.paid.background,
  onPrimary: neutrals.paper,
} as const;

export const fontFamily = fontStack;

export const radius = {
  sm: radii.sm,
  md: radii.lg,
  lg: radii.panel,
} as const;

export const shadow = {
  card: shadows.small,
} as const;
