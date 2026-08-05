// Single source of truth for brand colors.
// Matches the CSS custom properties in index.css — change here AND there together.

export const BRAND = {
  primary:      '#0E7C61',
  primaryDark:  '#0A5C49',
  primaryLight: '#12A07D',
  accent:       '#C6A75E',
  accentDark:   '#a0883c',
  danger:       '#DC2626',
  dangerDark:   '#991B1B',
  warning:      '#F59E0B',
  warningDark:  '#B45309',
  info:         '#0EA5E9',
  infoDark:     '#0369A1',
  purple:       '#7C3AED',
  purpleDark:   '#5B21B6',
  navy:         '#1b2a4a',
  navyDark:     '#0f1a30',
  slate:        '#334155',
  slateDark:    '#1E293B',
  white:        '#ffffff',
  black:        '#000000',
};

// Gradient presets for banners and backgrounds — all derived from BRAND
export const GRADIENT_PRESETS = [
  { label: 'Forest',  value: `linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.primaryDark} 100%)` },
  { label: 'Gold',    value: `linear-gradient(135deg,${BRAND.accent} 0%,${BRAND.accentDark} 100%)` },
  { label: 'Navy',    value: `linear-gradient(135deg,${BRAND.navy} 0%,${BRAND.navyDark} 100%)` },
  { label: 'Purple',  value: `linear-gradient(135deg,${BRAND.purple} 0%,${BRAND.purpleDark} 100%)` },
  { label: 'Red',     value: `linear-gradient(135deg,${BRAND.danger} 0%,${BRAND.dangerDark} 100%)` },
  { label: 'Blue',    value: `linear-gradient(135deg,${BRAND.info} 0%,${BRAND.infoDark} 100%)` },
  { label: 'Slate',   value: `linear-gradient(135deg,${BRAND.slate} 0%,${BRAND.slateDark} 100%)` },
  { label: 'Custom',  value: '' },
];

// Chart/analytics palette — ordered for contrast across series
export const CHART_PALETTE = [
  BRAND.primary, BRAND.accent, BRAND.warning, BRAND.danger,
  BRAND.purple,  BRAND.info,   '#ec4899',     '#14b8a6',
];

// Semantic status colors used for badges and indicators
export const STATUS = {
  success: { bg: '#d1fae5', text: '#065f46', dot: BRAND.primaryLight },
  warning: { bg: '#fef3c7', text: '#92400e', dot: BRAND.warning },
  error:   { bg: '#fee2e2', text: '#991b1b', dot: BRAND.danger },
  info:    { bg: '#dbeafe', text: '#1d4ed8', dot: BRAND.info },
  purple:  { bg: '#ede9fe', text: '#5b21b6', dot: BRAND.purple },
};
