import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useThemeMode } from '@/hooks/use-theme-context';
import { Colors } from '@/constants/theme';

function ProfileAvatar({ onPress, colors }: { onPress: () => void; colors: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.avatar, { opacity: pressed ? 0.6 : 1, backgroundColor: colors.tint || '#007AFF' }]}>
      <Text style={styles.avatarText}>T</Text>
    </Pressable>
  );
}

export default function AppTabs() {
  const { resolvedScheme } = useThemeMode();
  const colors = Colors[resolvedScheme];
  const router = useRouter();

  return (
    <>
      <NativeTabs
        backgroundColor={colors.background}
        indicatorColor={colors.backgroundElement}
        labelStyle={{ selected: { color: colors.text } }}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require('@/assets/images/tabIcons/home.png')}
            renderingMode="template"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="explore">
          <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require('@/assets/images/tabIcons/explore.png')}
            renderingMode="template"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="pos">
          <NativeTabs.Trigger.Label>POS</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require('@/assets/images/tabIcons/home.png')}
            renderingMode="template"
          />
        </NativeTabs.Trigger>
      </NativeTabs>
      <ProfileAvatar
        onPress={() => router.push('/settings')}
        colors={colors}
      />
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
