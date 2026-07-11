import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { SectionProps } from '../ComponentRegistry';

export default function QuickActions({ props, designTokens, onExecuteAction }: SectionProps) {
  const { title, layout = 'grid' } = props;
  const { colors, rounded, spacing } = designTokens;

  // Actions come from data prop as array of { name, label, icon }
  const actions = (props as any).actions || [];

  return (
    <View style={styles.container}>
      {title && (
        <Text style={[styles.title, { color: colors.primary, marginBottom: 6 }]}>
          {title}
        </Text>
      )}
      <View style={[styles.grid, { gap: 8 }]}>
        {actions.map((action: any, idx: number) => (
          <Pressable
            key={action.name || idx}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: colors.primary + (pressed ? 'dd' : '10'),
                borderRadius: rounded.sm,
                paddingHorizontal: 12,
                paddingVertical: 8,
              },
            ]}
            onPress={() => onExecuteAction?.(action.name, {})}
          >
            <Ionicons
              name={(action.icon || 'flash-outline') as any}
              size={16}
              color={colors.primary}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  title: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, color: '#94a3b8' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
