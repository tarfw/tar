import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SectionProps } from '../ComponentRegistry';

export default function DataTable({ props, designTokens, data = [] }: SectionProps) {
  const { title, emptyMessage } = props;
  const { colors, rounded } = designTokens;

  return (
    <View style={styles.container}>
      {title && (
        <Text style={[styles.title, { color: colors.primary, marginBottom: 6 }]}>
          {title}
        </Text>
      )}
      <View
        style={[
          styles.table,
          {
            backgroundColor: '#fff',
            borderColor: 'rgba(0,0,0,0.06)',
            borderRadius: rounded.sm || 8,
            padding: 8,
          },
        ]}
      >
        {data.length === 0 ? (
          <Text style={[styles.empty, { color: '#94a3b8' }]}>
            {emptyMessage || 'No records'}
          </Text>
        ) : (
          data.map((row: any, idx: number) => (
            <View
              key={row.id || idx}
              style={[
                styles.row,
                {
                  borderBottomWidth: idx < data.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: 'rgba(0,0,0,0.06)',
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                },
              ]}
            >
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: '#111' }]} numberOfLines={1}>
                  {row.title || row.id}
                </Text>
                {row.value !== undefined && (
                  <Text style={[styles.rowValue, { color: colors.tertiary || colors.primary }]}>
                    ${row.value}
                  </Text>
                )}
              </View>
              {(row.subtitle || row.description || row.type) && (
                <Text style={[styles.rowSubtitle, { color: '#94a3b8' }]} numberOfLines={1}>
                  {row.subtitle || row.description || row.type}
                </Text>
              )}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  title: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, color: '#94a3b8' },
  table: { borderWidth: 1 },
  empty: { fontSize: 12, padding: 10, textAlign: 'center' },
  row: {},
  rowContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontSize: 13, fontWeight: '500', flex: 1 },
  rowValue: { fontSize: 13, fontWeight: '600' },
  rowSubtitle: { fontSize: 11, marginTop: 1, color: '#94a3b8' },
});
