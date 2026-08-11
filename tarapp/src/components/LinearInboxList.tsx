import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { TarLogo } from '@/components/TarLogo';

export interface LinearInboxItem {
  id: string;
  type: string;
  title: string;
  status: string;
  ref?: string;
  due?: number | string;
  created_at?: string;
  data?: any;
}

interface LinearInboxListProps {
  tasks: LinearInboxItem[];
  loading?: boolean;
  onToggleDone?: (id: string) => void;
  onSelectTask?: (task: LinearInboxItem) => void;
  headerRight?: React.ReactNode;
  headerLeft?: React.ReactNode;
}

export default function LinearInboxList({
  tasks,
  loading = false,
  onToggleDone,
  onSelectTask,
  headerRight,
  headerLeft,
}: LinearInboxListProps) {
  const theme = useTheme();

  const getTypeStyle = (type: string) => {
    const t = type?.toLowerCase() || 'task';
    if (t.includes('order') || t === 'sale') return { bg: theme.primary + '18', text: theme.primary };
    if (t.includes('stock') || t === 'alert') return { bg: '#ef444420', text: '#ef4444' };
    if (t.includes('booking')) return { bg: '#8b5cf620', text: '#8b5cf6' };
    if (t.includes('delivery')) return { bg: '#f59e0b20', text: '#f59e0b' };
    return { bg: theme.border + '60', text: theme.textSecondary };
  };

  const getSubtitleText = (item: LinearInboxItem): string => {
    const d = item.data;
    if (!d) return '';

    if (typeof d === 'string') {
      return d.toLowerCase().includes((item.title || '').toLowerCase()) ? '' : d;
    }

    const parts: string[] = [];
    const titleLower = (item.title || '').toLowerCase();

    const addPart = (str: string, rawVal?: string) => {
      const check = (rawVal || str).toLowerCase().trim();
      if (check && !titleLower.includes(check)) {
        parts.push(str);
      }
    };

    if (d.items) addPart(d.items);
    if (d.total || d.amount || d.price) {
      const valStr = `$${d.total || d.amount || d.price}`;
      addPart(valStr);
    }
    if (d.payment_method) addPart(`Payment: ${d.payment_method}`, d.payment_method);
    if (d.customer_id || d.customer || d.client) {
      const cust = d.customer_id || d.customer || d.client;
      addPart(`Customer: ${cust}`, cust);
    }
    if (d.service) addPart(`Service: ${d.service}`, d.service);
    if (d.slot || d.date) addPart(`Time: ${d.slot || d.date}`, d.slot || d.date);
    if (d.qty !== undefined && d.qty !== null && !titleLower.includes(`${d.qty}`)) {
      parts.push(`Stock: ${d.qty} units remaining`);
    }
    if (d.reason) addPart(`Reason: ${d.reason}`, d.reason);
    if (d.notes || d.description) addPart(`${d.notes || d.description}`, d.notes || d.description);

    return parts.join(' • ');
  };

  const renderItem = ({ item }: { item: LinearInboxItem }) => {
    const typeStyle = getTypeStyle(item.type);
    const subtitle = getSubtitleText(item);
    const timeDisplay = item.created_at
      ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : item.due
      ? typeof item.due === 'number'
        ? new Date(item.due * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : item.due
      : '';

    return (
      <Pressable
        onPress={() => onSelectTask?.(item)}
        style={({ pressed }) => [
          styles.row,
          {
            borderBottomColor: theme.border + '40',
            backgroundColor: pressed ? theme.backgroundElement : 'transparent',
          },
        ]}
      >
        {/* Checkbox Icon */}
        <Pressable
          onPress={() => onToggleDone?.(item.id)}
          style={({ pressed }) => [styles.checkbox, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={8}
        >
          <Ionicons name="ellipse-outline" size={18} color={theme.textMuted} />
        </Pressable>

        {/* Content Column (Line 1 + Line 2) */}
        <View style={styles.contentCol}>
          {/* Line 1: Badge + Title + Time */}
          <View style={styles.lineOne}>
            <View style={[styles.badge, { backgroundColor: typeStyle.bg }]}>
              <Text style={[styles.badgeText, { color: typeStyle.text }]}>
                {item.type ? item.type.toUpperCase() : 'TASK'}
              </Text>
            </View>

            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {item.title}
            </Text>

            {timeDisplay ? (
              <Text style={[styles.time, { color: theme.textMuted }]}>
                {timeDisplay}
              </Text>
            ) : null}
          </View>

          {/* Line 2: Subtitle Details (if available) */}
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { borderBottomColor: theme.border + '40', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        {headerLeft ? headerLeft : (
          <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
            INBOX ({tasks?.length || 0})
          </Text>
        )}
        {headerLeft ? (
          <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>
            INBOX ({tasks?.length || 0})
          </Text>
        ) : (
          headerRight
        )}
      </View>

      {loading ? (
        <View style={[styles.center, { paddingVertical: 40 }]}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      ) : !tasks || tasks.length === 0 ? (
        <View style={[styles.emptyContainer, { borderColor: theme.border + '40' }]}>
          <TarLogo size={32} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>All caught up</Text>
          <Text style={[styles.emptySub, { color: theme.textMuted }]}>
            No pending tasks
          </Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          scrollEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  headerRow: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    marginRight: 10,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentCol: {
    flex: 1,
  },
  lineOne: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  title: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    marginRight: 8,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 3,
    paddingLeft: 2,
  },
  time: {
    fontSize: 11,
    fontWeight: '400',
  },
  emptyContainer: {
    minHeight: 380,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
