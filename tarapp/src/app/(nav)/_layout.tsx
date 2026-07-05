import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useThemeMode } from '@/hooks/use-theme-context';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  const { resolvedScheme } = useThemeMode();
  const colors = Colors[resolvedScheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      tintColor={colors.textSecondary}
      labelStyle={{ color: colors.text, selected: { color: colors.text } }}
      indicatorColor={colors.backgroundElement}
      rippleColor="rgba(128,128,128,0.3)">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
