/**
 * Tractor Ledger Design System — Color Palette
 * 
 * Village-friendly design: high contrast, debt=red, payment=green.
 * Warm off-white background like paper.
 */

export const Colors = {
  // Primary brand
  primary: '#1B6CA8',       // deep tractor blue
  primaryLight: '#4A90C4',  // lighter blue for hover/active states
  primaryDark: '#14507E',   // darker blue for pressed states
  primaryBg: '#E8F2F9',     // very light blue background tint

  // Semantic
  success: '#2E7D32',       // crop green — payments received
  successLight: '#4CAF50',  // lighter green
  successBg: '#E8F5E9',     // green background tint
  danger: '#C62828',        // due amount — red alert
  dangerLight: '#E53935',   // lighter red
  dangerBg: '#FFEBEE',      // red background tint
  warning: '#E65100',       // partial due — orange
  warningLight: '#FF6D00',  // lighter orange
  warningBg: '#FFF3E0',     // orange background tint

  // Neutrals
  background: '#F5F5F0',    // warm off-white, like paper
  surface: '#FFFFFF',       // cards, modals
  surfaceElevated: '#FAFAFA',
  text: '#1A1A1A',          // primary text
  textSecondary: '#616161', // secondary/sub text
  textTertiary: '#9E9E9E',  // placeholder, disabled
  border: '#E0E0E0',        // standard border
  borderLight: '#EEEEEE',   // subtle border
  divider: '#F0F0F0',       // section dividers

  // Special
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',  // modal overlay
  shadow: 'rgba(0, 0, 0, 0.08)',  // card shadow

  // Status
  synced: '#2E7D32',        // green dot — synced
  syncing: '#F9A825',       // yellow spinner — syncing
  offline: '#C62828',       // red dot — offline
} as const;

export type ColorKey = keyof typeof Colors;
