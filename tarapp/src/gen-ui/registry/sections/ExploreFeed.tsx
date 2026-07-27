import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { SectionProps } from '../ComponentRegistry';

const EXPLORE_CATEGORIES = [
  { id: 'all', label: 'All Businesses', icon: 'apps-outline' },
  { id: 'bakery', label: 'Bakery & Cafe', icon: 'pizza-outline' },
  { id: 'retail', label: 'Clothing & Retail', icon: 'shirt-outline' },
  { id: 'taxi', label: 'Transport & Cabs', icon: 'car-outline' },
  { id: 'beauty', label: 'Salon & Spa', icon: 'rose-outline' },
];

const MOCK_EXPLORE_ITEMS = [
  {
    id: 'exp_1',
    name: 'Croissant & Cafe',
    category: 'bakery',
    description: 'Artisanal French pastries, sourdough bread, and specialty coffee.',
    productsCount: 14,
    rating: '4.9 ★',
    emoji: '🥐',
    tagColor: '#fff1f2',
    textColor: '#e11d48',
  },
  {
    id: 'exp_2',
    name: 'Mumbai Urban Cabs',
    category: 'taxi',
    description: 'Airport transfers, hourly rentals, and city outstation rides.',
    productsCount: 8,
    rating: '4.8 ★',
    emoji: '🚕',
    tagColor: '#eff6ff',
    textColor: '#2563eb',
  },
  {
    id: 'exp_3',
    name: 'Velvet Salon & Spa',
    category: 'beauty',
    description: 'Hair styling, facial care, manicure, and wellness therapy.',
    productsCount: 12,
    rating: '4.9 ★',
    emoji: '💇',
    tagColor: '#faf5ff',
    textColor: '#9333ea',
  },
  {
    id: 'exp_4',
    name: 'Trendsetters Apparel',
    category: 'retail',
    description: 'Modern fashion collections, streetwear, and summer wear.',
    productsCount: 32,
    rating: '4.7 ★',
    emoji: '🛍️',
    tagColor: '#ecfdf5',
    textColor: '#059669',
  },
];

export default function ExploreFeed({ props, designTokens, onExecuteAction }: SectionProps) {
  const [selectedCat, setSelectedCat] = useState('all');

  const filteredItems = MOCK_EXPLORE_ITEMS.filter(
    (item) => selectedCat === 'all' || item.category === selectedCat
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Explore Public Workspaces</Text>

      {/* Category Horizontal Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
        {EXPLORE_CATEGORIES.map((cat) => {
          const active = selectedCat === cat.id;
          return (
            <Pressable
              key={cat.id}
              style={[styles.catChip, active && styles.catChipActive]}
              onPress={() => setSelectedCat(cat.id)}
            >
              <Ionicons
                name={cat.icon as any}
                size={14}
                color={active ? '#ffffff' : '#64748b'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Explore Cards Grid */}
      <View style={styles.cardsWrapper}>
        {filteredItems.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
            onPress={() => {
              if (onExecuteAction) {
                onExecuteAction('view_storefront', { subdomain: item.name });
              } else {
                Alert.alert('Workspace', `Opening ${item.name}...`);
              }
            }}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.emojiBadge, { backgroundColor: item.tagColor }]}>
                <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <View style={styles.ratingRow}>
                  <Text style={[styles.ratingText, { color: item.textColor }]}>
                    {item.rating}
                  </Text>
                  <Text style={styles.dotSeparator}>•</Text>
                  <Text style={styles.productCount}>{item.productsCount} catalog items</Text>
                </View>
              </View>
            </View>
            <Text style={styles.cardDesc}>{item.description}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  catScroll: {
    marginBottom: 16,
    flexDirection: 'row',
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    marginRight: 8,
  },
  catChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  catChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  cardsWrapper: {
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  emojiBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dotSeparator: {
    marginHorizontal: 6,
    color: '#cbd5e1',
    fontSize: 12,
  },
  productCount: {
    fontSize: 12,
    color: '#64748b',
  },
  cardDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
});
