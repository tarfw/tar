import { useState } from 'react';
import { StyleSheet, ScrollView, Pressable, Switch, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeMode } from '@/hooks/use-theme-context';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { themeMode, setThemeMode } = useThemeMode();
  const [notifications, setNotifications] = useState(true);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>

      {/* Profile Card */}
      <Pressable style={[styles.profileCard, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>T</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: theme.text }]}>Tarai User</Text>
          <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>user@tarai.app</Text>
        </View>
        <Text style={[styles.chevron, { color: theme.textSecondary }]}>{'>'}</Text>
      </Pressable>

      {/* Appearance */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>APPEARANCE</Text>
      <View style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
        <OptionRow
          label="Light"
          theme={theme}
          checked={themeMode === 'light'}
          onPress={() => setThemeMode('light')}
          isLast={false}
        />
        <OptionRow
          label="Dark"
          theme={theme}
          checked={themeMode === 'dark'}
          onPress={() => setThemeMode('dark')}
          isLast={false}
        />
        <OptionRow
          label="System"
          theme={theme}
          checked={themeMode === 'system'}
          onPress={() => setThemeMode('system')}
          isLast={true}
        />
      </View>

      {/* Notifications */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>NOTIFICATIONS</Text>
      <View style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Push Notifications</Text>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: '#E9E9EA', true: '#34C759' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* General */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>GENERAL</Text>
      <View style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Language</Text>
          <View style={styles.rowRight}>
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>English</Text>
          </View>
        </View>
        <View style={[styles.separator, { backgroundColor: theme.background }]} />
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Region</Text>
          <View style={styles.rowRight}>
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>United States</Text>
          </View>
        </View>
      </View>

      {/* About */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ABOUT</Text>
      <View style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Version</Text>
          <Text style={[styles.rowValue, { color: theme.textSecondary }]}>1.0.0</Text>
        </View>
        <View style={[styles.separator, { backgroundColor: theme.background }]} />
        <Pressable style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Privacy Policy</Text>
          <Text style={[styles.chevron, { color: theme.textSecondary }]}>{'>'}</Text>
        </Pressable>
        <View style={[styles.separator, { backgroundColor: theme.background }]} />
        <Pressable style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Terms of Service</Text>
          <Text style={[styles.chevron, { color: theme.textSecondary }]}>{'>'}</Text>
        </Pressable>
      </View>

      {/* Sign Out */}
      <Pressable
        style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.6 }]}
        onPress={() => router.back()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

function OptionRow({ label, theme, checked, onPress, isLast }: {
  label: string;
  theme: any;
  checked: boolean;
  onPress: () => void;
  isLast: boolean;
}) {
  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
        onPress={onPress}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </Pressable>
      {!isLast && <View style={[styles.separator, { backgroundColor: theme.background }]} />}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 28,
    marginBottom: 8,
    marginLeft: 30,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 44,
  },
  rowLabel: {
    fontSize: 17,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 17,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  checkmark: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 16,
    fontWeight: '600',
  },
  signOut: {
    backgroundColor: '#FF3B30',
    marginHorizontal: 16,
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
