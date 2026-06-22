import { useState, useEffect, useCallback } from 'react';
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

function parseData(data: string): Record<string, any> {
  try { return JSON.parse(data); } catch { return {}; }
}

const PERSONAL_FORM_ID = '__personal_profile__';
const NOTION_AVATAR = require('../../assets/images/profile avatar.webp');

export default function PersonalScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const db = useDb();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [localTitle, setLocalTitle] = useState('');
  const [motions, setMotions] = useState<any[]>([]);
  const [detailTab, setDetailTab] = useState<'activity' | 'details'>('activity');

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;

    const existing = await db.getFirstAsync<FormRow>(
      'SELECT * FROM form WHERE id = ?',
      PERSONAL_FORM_ID
    );
    if (existing) {
      setLocalTitle(existing.title);
    } else if (user.name) {
      setLocalTitle(user.name);
    }

    const mov = await db.getAllAsync<any>(
      "SELECT * FROM motion WHERE stream = ? ORDER BY seq DESC LIMIT 20",
      PERSONAL_FORM_ID
    );
    setMotions(mov);
  }, [db, user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

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

  const formatTime = (time: string) => {
    const d = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  };

  const motionLabel = (action: number) => {
    const labels: Record<number, string> = {
      100: 'Subtask added',
    };
    return labels[action] || `Action ${action}`;
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      </View>
    );
  }

  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : user.email.charAt(0).toUpperCase();

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
            {motions.length > 0 ? motions.map((m, i) => {
              const md = parseData(m.data);
              return (
                <View key={i} style={styles.timelineRow}>
                  <View style={[styles.timelineDot, { backgroundColor: theme.textSecondary }]} />
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineTitle, { color: theme.text }]}>{motionLabel(m.action)}</Text>
                    <Text style={[styles.timelineMeta, { color: theme.textSecondary }]}>
                      {formatTime(m.time)}
                      {md.title ? ` · ${md.title}` : ''}
                    </Text>
                  </View>
                </View>
              );
            }) : (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No activity yet</Text>
            )}
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
