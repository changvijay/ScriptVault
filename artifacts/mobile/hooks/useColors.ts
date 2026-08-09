import { useTheme } from '@/context/ThemeContext';

/**
 * Returns the design tokens for the current active color scheme.
 *
 * Automatically updates when the user changes theme mode (System, Light, Dark).
 */
export function useColors() {
  const { colors } = useTheme();
  return colors;
}

export { useTheme } from '@/context/ThemeContext';

