import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SectionProps } from '../ComponentRegistry';

export default function BookingGrid({ props, designTokens, data = [] }: SectionProps) {
  const { title, slotsPerRow = 3 } = props;
  const { colors, rounded, spacing } = designTokens;

  return (
    <View style={[styles.container, { marginBottom: spacing.lg }]}>
      {title && (
        <Text style={[styles.title, { color: colors.primary, marginBottom: spacing.sm }]}>
          {title}
        </Text>
      )}
      {data.length === 0 ? (
        <Text style={[styles.empty, { color: '#94a3b8' }]}>No bookings today</Text>
      ) : (
        <View style={[styles.grid, { gap: spacing.sm }]}>
          {data.map((booking: any, idx: number) => (
            <View
              key={booking.id || idx}
              style={[
                styles.slot,
                {
                  flex: 1 / slotsPerRow,
                  backgroundColor: '#fff',
                  borderRadius: rounded.sm,
                  borderWidth: 1,
                  borderColor: 'rgba(0,0,0,0.05)',
                  padding: spacing.sm,
                },
              ]}
            >
              <Text style={[styles.slotTime, { color: colors.primary }]} numberOfLines={1}>
                {booking.data?.slot || booking.data?.time || '--:--'}
              </Text>
              <Text style={[styles.slotName, { color: '#111' }]} numberOfLines={1}>
                {booking.data?.customer || booking.title || 'Guest'}
              </Text>
              <Text style={[styles.slotService, { color: '#64748b' }]} numberOfLines={1}>
                {booking.data?.service || ''}
              </Text>
            </View>
          ))}
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
  slot: { marginBottom: 8 },
  slotTime: { fontSize: 14, fontWeight: '700' },
  slotName: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  slotService: { fontSize: 11, marginTop: 1 },
});
