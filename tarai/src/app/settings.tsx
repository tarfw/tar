import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, Pressable, Switch, View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeMode } from '@/hooks/use-theme-context';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentUser, signOutGoogle, type UserProfile } from '@/lib/auth';
import { useEmbeddings } from '@/db/embeddings-provider';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { themeMode, setThemeMode } = useThemeMode();
  const { isReady, isLoading, downloadProgress, error, loadModel, clearModel } = useEmbeddings();
  const [notifications, setNotifications] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOutGoogle();
      router.replace('/auth');
    } catch (_) {
      router.replace('/auth');
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'T';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }}>

      <Pressable
        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
        onPress={() => router.back()}>
        <Text style={[styles.backText, { color: '#007AFF' }]}>‹</Text>
      </Pressable>

      <View style={styles.profileSection}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>{initials}</Text>
        </View>
        <Text style={[styles.profileName, { color: theme.text }]}>{user?.name || 'Tarai User'}</Text>
        <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>{user?.email || 'user@tarai.app'}</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>AI MODELS</Text>
      <View style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Embedding (350M)</Text>
          <View style={styles.rowRight}>
            {isReady && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#34C759', fontSize: 13, fontWeight: '500' }}>Ready</Text>
                <Pressable
                  style={({ pressed }) => [styles.downloadBtn, { backgroundColor: theme.background }, pressed && { opacity: 0.6 }]}
                  onPress={() => {
                    console.log('[SETTINGS] Clear button pressed');
                    clearModel();
                  }}>
                  <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '500' }}>Clear</Text>
                </Pressable>
              </View>
            )}
            {isLoading && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 12, minWidth: 32, textAlign: 'right' }}>
                  {Math.round(downloadProgress * 100)}%
                </Text>
              </View>
            )}
            {error && <Text style={{ color: '#FF3B30', fontSize: 13 }}>Failed</Text>}
            {!isReady && !isLoading && !error && (
              <Pressable
                style={({ pressed }) => [styles.downloadBtn, { backgroundColor: theme.background }, pressed && { opacity: 0.6 }]}
                onPress={() => {
                  console.log('[SETTINGS] Download button pressed — calling loadModel()');
                  loadModel();
                }}>
                <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500' }}>Download</Text>
              </Pressable>
            )}
          </View>
        </View>
        <View style={[styles.separator, { backgroundColor: theme.background }]} />
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Model Info</Text>
          <Text style={[styles.rowValue, { color: theme.textSecondary }]}>1024-dim • Cosine • Quantized</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>APPEARANCE</Text>
      <View style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
        <OptionRow label="Light" theme={theme} checked={themeMode === 'light'} onPress={() => setThemeMode('light')} isLast={false} />
        <OptionRow label="Dark" theme={theme} checked={themeMode === 'dark'} onPress={() => setThemeMode('dark')} isLast={false} />
        <OptionRow label="System" theme={theme} checked={themeMode === 'system'} onPress={() => setThemeMode('system')} isLast={true} />
      </View>

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

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ACCOUNT</Text>
      <View style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
          onPress={handleSignOut}>
          <Text style={[styles.rowLabel, { color: '#FF3B30' }]}>Sign Out</Text>
        </Pressable>
      </View>
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
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 28,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '600',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 12,
  },
  profileEmail: {
    fontSize: 15,
    marginTop: 4,
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
  downloadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  progressTrack: {
    width: 60,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5EA',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#007AFF',
  },
});
