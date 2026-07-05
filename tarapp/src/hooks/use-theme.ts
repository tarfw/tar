import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/hooks/use-theme-context';

export function useTheme() {
  const { resolvedScheme } = useThemeMode();
  return Colors[resolvedScheme];
}
