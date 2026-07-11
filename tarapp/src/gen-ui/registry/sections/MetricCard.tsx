import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { SectionProps } from '../ComponentRegistry';

export default function MetricCard({ props, designTokens }: SectionProps) {
  const { title, value, icon, trend } = props;
  const { colors, rounded } = designTokens;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.primary + '08',
          borderRadius: rounded.sm || 8,
          paddingHorizontal: 14,
          paddingVertical: 12,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.secondary || colors.primary }]}>
          {title || 'Metric'}
        </Text>
        {icon && (
          <Ionicons name={icon as any} size={14} color={colors.secondary || colors.primary} />
        )}
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.primary }]}>{value ?? '0'}</Text>
        {trend && (
          <Ionicons
            name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'}
            size={12}
            color={trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#94a3b8'}
            style={{ marginLeft: 4 }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 11, fontWeight: '500' },
  valueRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  value: { fontSize: 22, fontWeight: '700' },
});
