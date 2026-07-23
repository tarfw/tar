import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SectionProps } from '../ComponentRegistry';

export default function CatalogGrid({ props, designTokens, data = [] }: SectionProps) {
  const { title, columns = 2, emptyMessage } = props;
  const { colors, rounded, spacing } = designTokens;

  return (
    <View style={[styles.container, { marginBottom: spacing.lg }]}>
      {title && (
        <Text style={[styles.title, { color: colors.primary, marginBottom: spacing.sm }]}>
          {title}
        </Text>
      )}
      {data.length === 0 ? (
        <Text style={[styles.empty, { color: '#94a3b8' }]}>
          {emptyMessage || 'No items'}
        </Text>
      ) : (
        <View style={[styles.grid, { gap: spacing.sm }]}>
          {data.map((item: any, idx: number) => {
            let itemDataObj: any = {};
            if (typeof item.data === 'string') {
              try { itemDataObj = JSON.parse(item.data); } catch {}
            } else if (typeof item.data === 'object' && item.data !== null) {
              itemDataObj = item.data;
            }

            const itemTitle = item.title || item.name || itemDataObj.title || 'Product';
            const price = itemDataObj.price ?? item.price;
            const stock = item.value ?? itemDataObj.stock;
            const desc = item.description || itemDataObj.category || (stock !== undefined ? `Stock: ${stock}` : 'Quality product');

            return (
              <View
                key={item.id || idx}
                style={[
                  styles.card,
                  {
                    flex: 1 / columns,
                    backgroundColor: '#fff',
                    borderRadius: rounded.md,
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.05)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.cardImage,
                    { backgroundColor: colors.secondary || colors.primary },
                  ]}
                />
                <View style={[styles.cardBody, { padding: spacing.sm }]}>
                  <Text style={[styles.cardTitle, { color: '#111' }]} numberOfLines={1}>
                    {itemTitle}
                  </Text>
                  <Text style={[styles.cardDesc, { color: '#64748b' }]} numberOfLines={2}>
                    {desc}
                  </Text>
                  {price !== undefined && (
                    <Text style={[styles.cardPrice, { color: colors.primary || '#10b981' }]}>
                      ₹{price}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  title: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { fontSize: 13, padding: 12, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { marginBottom: 8 },
  cardImage: { height: 120 },
  cardBody: {},
  cardTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  cardDesc: { fontSize: 12, marginBottom: 4 },
  cardPrice: { fontSize: 14, fontWeight: '700' },
});
