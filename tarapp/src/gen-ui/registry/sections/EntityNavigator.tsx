import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { SectionProps } from '../ComponentRegistry';

const ENTITY_ICONS: Record<string, string> = {
  pipeline: 'funnel-outline',
  contacts: 'people-outline',
  companies: 'business-outline',
  deals: 'cash-outline',
  activities: 'time-outline',
};

export default function EntityNavigator({ props, designTokens }: SectionProps) {
  const { title, entities = ['pipeline', 'contacts', 'companies', 'deals', 'activities'] } = props;
  const { colors, rounded } = designTokens;

  const handlePress = (entity: string) => {
    Alert.alert('Navigate', `Opening ${entity} manager...`);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.secondary || colors.primary }]}>
        {title || 'Entity Navigator'}
      </Text>
      <View
        style={[
          styles.wrapper,
          {
            backgroundColor: '#fff',
            borderColor: 'rgba(0,0,0,0.06)',
            borderRadius: rounded.sm || 8,
            padding: 10,
          },
        ]}
      >
        <View style={styles.grid}>
          {entities.map((entity: string) => {
            const icon = ENTITY_ICONS[entity] || 'cube-outline';
            return (
              <Pressable
                key={entity}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    borderColor: 'rgba(0,0,0,0.06)',
                    backgroundColor: pressed ? 'rgba(0,0,0,0.02)' : 'transparent',
                    borderRadius: rounded.sm || 8,
                  },
                ]}
                onPress={() => handlePress(entity)}
              >
                <Ionicons name={icon as any} size={15} color={colors.primary} />
                <Text style={[styles.chipText, { color: '#334155' }]}>{entity}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  title: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  wrapper: { borderWidth: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    gap: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});
