import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useThemeMode } from '@/hooks/use-theme-context';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  const { resolvedScheme } = useThemeMode();
  const colors = Colors[resolvedScheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      iconColor={{
        default: colors.textSecondary,
        selected: colors.primary,
      }}
      labelVisibilityMode="unlabeled"
      indicatorColor={colors.primary + '25'}
      rippleColor="rgba(128,128,128,0.3)">
      
      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'compass', selected: 'compass.fill' }}
          md={{ default: 'explore', selected: 'explore' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="workspaces">
        <NativeTabs.Trigger.Label>Workspaces</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'briefcase', selected: 'briefcase.fill' }}
          md={{ default: 'work_outline', selected: 'work' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="inbox">
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'tray', selected: 'tray.fill' }}
          md={{ default: 'inbox', selected: 'inbox' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'message', selected: 'message.fill' }}
          md={{ default: 'chat_bubble_outline', selected: 'chat_bubble' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          md={{ default: 'settings', selected: 'settings' }}
        />
      </NativeTabs.Trigger>
      
    </NativeTabs>
  );
}
