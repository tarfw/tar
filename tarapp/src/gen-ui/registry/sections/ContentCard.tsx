import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SectionProps } from '../ComponentRegistry';

export default function ContentCard({ props, designTokens }: SectionProps) {
  const { title, body, imageUrl, ctaLabel, ctaAction } = props;
  const { colors, rounded, spacing } = designTokens;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: '#fff',
          borderRadius: rounded.md,
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.05)',
          overflow: 'hidden',
          marginBottom: spacing.lg,
        },
      ]}
    >
      {imageUrl && <View style={[styles.image, { backgroundColor: colors.secondary || '#e2e8f0' }]} />}
      <View style={{ padding: spacing.md }}>
        {title && <Text style={[styles.title, { color: '#111' }]}>{title}</Text>}
        {body && <Text style={[styles.body, { color: '#64748b' }]}>{body}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  image: { height: 160 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  body: { fontSize: 14, lineHeight: 20 },
});
