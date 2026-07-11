import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { SectionProps } from '../ComponentRegistry';

export default function TimelineFeed({ props, designTokens, data = [] }: SectionProps) {
  const { title, maxItems = 10 } = props;
  const { colors, rounded, spacing } = designTokens;
  const items = data.slice(0, maxItems);

  return (
    <View style={[styles.container, { marginBottom: spacing.lg }]}>
      {title && (
        <Text style={[styles.title, { color: colors.primary, marginBottom: spacing.sm }]}>
          {title}
        </Text>
      )}
      {items.length === 0 ? (
        <Text style={[styles.empty, { color: '#94a3b8' }]}>No recent activity</Text>
      ) : (
        items.map((item: any, idx: number) => (
          <View
            key={item.id || idx}
            style={[
              styles.entry,
              {
                borderBottomWidth: idx < items.length - 1 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: 'rgba(0,0,0,0.05)',
                paddingVertical: 8,
                paddingHorizontal: 4,
              },
            ]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: colors.tertiary || colors.primary },
              ]}
            />
            <View style={styles.content}>
              <Text style={[styles.entryTitle, { color: '#111' }]} numberOfLines={1}>
                {item.title || item.action || 'Activity'}
              </Text>
              <Text style={[styles.entryTime, { color: '#94a3b8' }]} numberOfLines={1}>
                {item.createdAt || item.time || ''}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  title: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { fontSize: 13, padding: 12, textAlign: 'center' },
  entry: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  content: { flex: 1 },
  entryTitle: { fontSize: 13, fontWeight: '500' },
  entryTime: { fontSize: 11, marginTop: 1 },
});
