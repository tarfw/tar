import { useState, useEffect } from 'react';
import { StyleSheet, Pressable, View, TextInput, Text, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { getCurrentUser, type UserProfile } from '@/lib/auth';
import { type FormRow } from '@/hooks/use-form';

const PERSONAL_FORM_ID = '__personal_profile__';
const NOTION_AVATAR = require('../../assets/images/profile avatar.webp');

export default function PersonalScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const db = useDb();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [localTitle, setLocalTitle] = useState('');
  const [detailTab, setDetailTab] = useState<'activity' | 'details'>('activity');

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const handleSaveTitle = async () => {
    if (!localTitle.trim()) return;
    const existing = await db.getFirstAsync<FormRow>(
      'SELECT id FROM form WHERE id = ?',
      PERSONAL_FORM_ID
    );
    if (existing) {
      await db.runAsync('UPDATE form SET title = ? WHERE id = ?', localTitle.trim(), PERSONAL_FORM_ID);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.titleRow}>
          <Image source={NOTION_AVATAR} style={styles.avatar} contentFit="cover" />
          <TextInput
            style={[styles.titleInput, { color: theme.text }]}
            value={localTitle}
            onChangeText={setLocalTitle}
            onBlur={handleSaveTitle}
            placeholder="Name"
            placeholderTextColor={theme.textSecondary}
          />
          <Pressable onPress={() => router.push('/settings')} style={styles.menuBtn}>
            <Ionicons name="settings-outline" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        {/* Contact chips */}
        <View style={styles.chipsRow}>
          {user.email ? (
            <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="mail-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.chipText, { color: theme.text }]}>{user.email}</Text>
            </View>
          ) : null}
        </View>

        {/* Tabs */}
        <View style={styles.storeTabs}>
          <Pressable
            style={[styles.storeTab, detailTab === 'activity' && { borderBottomColor: '#5E6AD2' }]}
            onPress={() => setDetailTab('activity')}>
            <Text style={[styles.storeTabText, { color: detailTab === 'activity' ? '#5E6AD2' : theme.textSecondary }]}>
              Activity
            </Text>
          </Pressable>
          <Pressable
            style={[styles.storeTab, detailTab === 'details' && { borderBottomColor: '#5E6AD2' }]}
            onPress={() => setDetailTab('details')}>
            <Text style={[styles.storeTabText, { color: detailTab === 'details' ? '#5E6AD2' : theme.textSecondary }]}>
              Details
            </Text>
          </Pressable>
        </View>

        {/* Activity Tab */}
        {detailTab === 'activity' && (
          <>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No activity yet</Text>
          </>
        )}

        {/* Details Tab */}
        {detailTab === 'details' && (
          <>
            {user.name ? (
              <View style={styles.timelineRow}>
                <View style={[styles.timelineDot, { backgroundColor: '#5E6AD2' }]} />
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineTitle, { color: theme.textSecondary }]}>Name</Text>
                  <Text style={[styles.timelineMeta, { color: theme.text }]}>{user.name}</Text>
                </View>
              </View>
            ) : null}
            {user.email ? (
              <View style={styles.timelineRow}>
                <View style={[styles.timelineDot, { backgroundColor: '#5E6AD2' }]} />
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineTitle, { color: theme.textSecondary }]}>Email</Text>
                  <Text style={[styles.timelineMeta, { color: theme.text }]}>{user.email}</Text>
                </View>
              </View>
            ) : null}
          </>
        )}

      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  titleInput: { flex: 1, fontSize: 22, fontWeight: '600', paddingVertical: 0 },
  menuBtn: { padding: 8 },
  chipsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, gap: 6 },
  chipText: { fontSize: 13, fontWeight: '500' },
  storeTabs: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 24, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.1)' },
  storeTab: { paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  storeTabText: { fontSize: 14, fontWeight: '500' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  timelineRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  timelineContent: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '500' },
  timelineMeta: { fontSize: 12, marginTop: 2 },
});
