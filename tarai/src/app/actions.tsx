import { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, ScrollView, Pressable, View, Text, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';

import { useTheme } from '@/hooks/use-theme';
import { useMotion, type ActionGroup, type ActionItem } from '@/hooks/use-motion';
import { getCurrentUser, type UserProfile } from '@/lib/auth';

type Urgency = 'Now' | 'Next' | 'Later' | 'Done';

function StatusDot({ status, color, size = 8 }: { status: 'todo' | 'in_progress' | 'done'; color: string; size?: number }) {
  if (status === 'todo') {
    return <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, borderColor: color, borderStyle: 'dotted' }]} />;
  }
  if (status === 'in_progress') {
    return <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderColor: color }]} />;
  }
  return <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: '#34C759', borderColor: '#34C759' }]} />;
}

function GroupSection({ group, theme, onPressGroup, onPressAction }: {
  group: ActionGroup;
  theme: any;
  onPressGroup: () => void;
  onPressAction: (action: ActionItem) => void;
}) {
  const tasks = group.actions.filter(a => a.vertical === 'task');
  const others = group.actions.filter(a => a.vertical !== 'task');
  const isTask = group.type === 'task';

  return (
    <View style={styles.groupSection}>
      <Pressable style={styles.groupHeader} onPress={onPressGroup}>
        <View style={[styles.groupAvatar, { backgroundColor: group.color }]}>
          <Text style={styles.groupAvatarText}>{group.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.groupInfo}>
          <Text style={[styles.groupName, { color: theme.text }]}>{group.name}</Text>
          <Text style={[styles.groupMeta, { color: theme.textSecondary }]}>
            {isTask ? `${tasks.length} task${tasks.length !== 1 ? 's' : ''}` : `${group.actions.length} action${group.actions.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
      </Pressable>

      {isTask ? (
        tasks.map((action) => {
          const subs = group.actions.filter(a => a.vertical === 'subtask' && a.routeParams.id === action.routeParams.id);
          return (
            <View key={action.id}>
              <Pressable style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]} onPress={() => onPressAction(action)}>
                <StatusDot status={action.status} color={theme.textSecondary} />
                <View style={styles.actionContent}>
                  <Text style={[styles.actionTitle, { color: theme.text }]}>{action.title}</Text>
                  {action.subtitle ? <Text style={[styles.actionSubtitle, { color: theme.textSecondary }]}>{action.subtitle}</Text> : null}
                </View>
              </Pressable>
              {subs.map((sub) => (
                <Pressable key={sub.id} style={({ pressed }) => [styles.subtaskRow, pressed && { opacity: 0.6 }]} onPress={() => onPressAction(sub)}>
                  <StatusDot status={sub.status} color={theme.textSecondary} size={6} />
                  <Text style={[styles.subtaskTitle, { color: sub.status === 'done' ? theme.textSecondary : theme.text, textDecorationLine: sub.status === 'done' ? 'line-through' : 'none' }]}>{sub.title}</Text>
                </Pressable>
              ))}
            </View>
          );
        })
      ) : (
        others.map((action) => (
          <Pressable key={action.id} style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]} onPress={() => onPressAction(action)}>
            <StatusDot status={action.status} color={theme.textSecondary} />
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: theme.text }]}>{action.title}</Text>
              {action.subtitle ? <Text style={[styles.actionSubtitle, { color: theme.textSecondary }]}>{action.subtitle}</Text> : null}
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

export default function ActionsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<Urgency>('Now');
  const { groups, loading, refresh } = useMotion();
  const [user, setUser] = useState<UserProfile | null>(null);

  const filters: Urgency[] = ['Now', 'Next', 'Later', 'Done'];

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => {});
  }, []);

  const isMounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (isMounted.current) refresh();
      isMounted.current = true;
    }, [refresh])
  );

  const handlePressGroup = (group: ActionGroup) => {
    router.push({ pathname: '/entity', params: { id: group.id } });
  };

  const handlePressAction = (action: ActionItem) => {
    router.push({ pathname: action.route as any, params: action.routeParams as any });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: theme.text }]}>Actions</Text>
      </View>

      <View style={styles.filters}>
        {filters.map((filter) => (
          <Pressable
            key={filter}
            style={[styles.filterTab, activeFilter === filter && [styles.filterTabActive, { borderColor: theme.text }]]}
            onPress={() => setActiveFilter(filter)}>
            <Text style={[styles.filterText, { color: activeFilter === filter ? theme.text : theme.textSecondary }, activeFilter === filter && styles.filterTextActive]}>
              {filter}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}>
          {groups.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>No actions</Text>
          ) : (
            groups.map((group) => (
              <GroupSection
                key={group.id}
                group={group}
                theme={theme}
                onPressGroup={() => handlePressGroup(group)}
                onPressAction={handlePressAction}
              />
            ))
          )}
        </ScrollView>
      )}

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12, backgroundColor: theme.background, borderColor: theme.backgroundElement }]}>
        <View style={styles.actionBarRow}>
          <Pressable style={styles.profileButton} onPress={() => router.push('/personal')}>
            <Image source={{ uri: user?.photo || '' }} style={styles.profileImage} contentFit="cover" />
          </Pressable>
          <View style={styles.chipRow}>
            <Pressable style={[styles.chip, { backgroundColor: theme.backgroundElement }]} onPress={() => router.push('/skills')}>
              <Text style={[styles.chipText, { color: theme.text }]}>Skills</Text>
            </Pressable>
            <Pressable style={[styles.chip, { backgroundColor: '#5E6AD220' }]} onPress={() => router.push('/chat')}>
              <Text style={[styles.chipText, { color: '#5E6AD2' }]}>tarai</Text>
            </Pressable>
          </View>
          <Pressable style={[styles.chip, { backgroundColor: theme.backgroundElement }]} onPress={() => router.push('/browse')}>
            <Text style={[styles.chipText, { color: theme.text }]}>Browse</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  filters: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, gap: 4 },
  filterTab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  filterTabActive: { borderBottomWidth: 2 },
  filterText: { fontSize: 14, fontWeight: '500' },
  filterTextActive: { fontWeight: '600' },
  scrollView: { flex: 1 },
  empty: { textAlign: 'center', paddingTop: 60, fontSize: 15 },
  groupSection: { marginBottom: 8 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  groupAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  groupAvatarText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 15, fontWeight: '600' },
  groupMeta: { fontSize: 12, marginTop: 2 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, paddingLeft: 60, gap: 10 },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: '400' },
  actionSubtitle: { fontSize: 12, marginTop: 1 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, paddingLeft: 84, gap: 8 },
  subtaskTitle: { fontSize: 13, fontWeight: '400', flex: 1 },
  dot: { borderWidth: 1.5 },
  actionBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: 16 },
  actionBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileButton: { padding: 2 },
  profileImage: { width: 38, height: 38, borderRadius: 19 },
  chipRow: { flexDirection: 'row', gap: 8, flex: 1 },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24 },
  chipText: { fontSize: 15, fontWeight: '600' },
});
