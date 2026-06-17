/**
 * Tractor Ledger Design System — Spacing & Layout
 * 
 * Consistent spacing scale based on 4px grid.
 * Minimum touch targets 56px for rough hands in fields.
 */

export const Spacing = {
  // Base scale (4px grid)
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export const Layout = {
  // Screen padding
  screenPaddingHorizontal: 16,
  screenPaddingVertical: 16,

  // Touch targets — minimum 56px for village users with rough hands
  minTouchTarget: 56,
  buttonHeight: 56,
  inputHeight: 56,
  listItemHeight: 72,

  // Cards
  cardPadding: 16,
  cardBorderRadius: 12,
  cardGap: 12,

  // Bottom tab bar
  tabBarHeight: 64,
  tabBarIconSize: 28,

  // Form elements
  inputBorderRadius: 10,
  inputPaddingHorizontal: 16,

  // FAB
  fabSize: 60,
  fabBorderRadius: 30,

  // Badge
  badgePaddingHorizontal: 10,
  badgePaddingVertical: 4,
  badgeBorderRadius: 20,

  // Header
  headerHeight: 56,

  // Max content width (for tablets)
  maxContentWidth: 600,
} as const;

export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;
