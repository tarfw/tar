import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Pressable, StyleSheet, Text, TextInput, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { tar } from '@/lib/tar';
import { TarLogoLoader } from '@/components/TarLogoLoader';

const MOCK_PUBLIC_WORKSPACES = [
  { subdomain: 'croissant-bakery', scope: 's:croissant-bakery', type: 'bakery', name: 'Croissant & Cafe', description: 'Artisanal French pastries, fresh sourdough bread, and premium coffee.' },
  { subdomain: 'quick-ride', scope: 's:quick-ride', type: 'taxi', name: 'Quick Ride', description: 'Reliable airport transfers and city rides with tracked drivers.' },
  { subdomain: 'glow-salon', scope: 's:glow-salon', type: 'beauty', name: 'Glow Salon', description: 'Premium unisex salon for hair, skin, and nail treatments.' },
  { subdomain: 'fashion-hub', scope: 's:fashion-hub', type: 'retail', name: 'Fashion Hub', description: 'Curated fashion collections with express home delivery.' },
  { subdomain: 'spice-garden', scope: 's:spice-garden', type: 'restaurant', name: 'Spice Garden', description: 'Authentic South Indian thalis and biryanis, delivered hot.' },
];

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'bakery', label: 'Bakery' },
  { id: 'taxi', label: 'Taxi' },
  { id: 'beauty', label: 'Beauty' },
  { id: 'retail', label: 'Retail' },
  { id: 'restaurant', label: 'Restaurant' },
];

const VERTICAL_EMOJI: Record<string, string> = {
  bakery: '\u{1F35A}',
  taxi: '\u{1F695}',
  beauty: '\u{1F487}',
  retail: '\u{1F6CD}',
  restaurant: '\u{1F37D}',
};

interface ExploreOverlayProps {
  visible: boolean;
  onClose: () => void;
  theme: any;
}

export default function ExploreOverlay({ visible, onClose, theme }: ExploreOverlayProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tar.listWorkspaces();
      const systemWorkspaces = (data.workspaces || []).map((w: any) => ({
        subdomain: w.subdomain,
        scope: w.scope,
        type: w.type || 'business',
        name: w.name || w.subdomain,
        description: `${w.type || 'Business'} services and storefront.`,
      }));

      const userSubdomains = new Set(systemWorkspaces.map((w: any) => w.subdomain));
      const merged = [...systemWorkspaces];
      MOCK_PUBLIC_WORKSPACES.forEach((mock) => {
        if (!userSubdomains.has(mock.subdomain)) {
          merged.push(mock);
        }
      });
      setWorkspaces(merged);
    } catch {
      setWorkspaces(MOCK_PUBLIC_WORKSPACES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) loadWorkspaces();
  }, [visible, loadWorkspaces]);

  const filtered = workspaces.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.type === selectedCategory;
    const matchesQuery =
      searchQuery.trim() === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.panel, { backgroundColor: theme.background, paddingTop: insets.top + 8 }]}>
        {/* Close button */}
        <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={theme.textMuted} />
        </Pressable>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: theme.border + '15', borderColor: theme.border + '40' }]}>
          <Ionicons name="search-outline" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={{ flex: 1, fontSize: 14, color: theme.text, paddingVertical: 8 }}
            placeholder="Search storefronts..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Categories */}
        <View style={{ paddingBottom: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: active ? theme.text : theme.border + '60',
                    backgroundColor: active ? theme.text : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 12.5,
                    fontWeight: active ? '600' : '400',
                    color: active ? theme.background : theme.textSecondary,
                  }}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* List */}
        <View style={styles.content}>
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <TarLogoLoader size={36} color={theme.primary} />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.subdomain}
              contentContainerStyle={{ paddingBottom: 16 }}
              renderItem={({ item }) => (
                <View style={[styles.itemRow, { borderBottomColor: theme.border }]}>
                  <View style={[styles.iconBox, { backgroundColor: theme.primary + '15' }]}>
                    <Text style={{ fontSize: 20 }}>{VERTICAL_EMOJI[item.type] || '\u2728'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: 13, color: theme.textMuted }} numberOfLines={1}>
                      {item.description || `${item.type.toUpperCase()} \u2022 ${item.subdomain}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </View>
              )}
              ListEmptyComponent={
                <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                  <Ionicons name="compass-outline" size={36} color={theme.textMuted} style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 14, color: theme.textMuted, fontWeight: '500' }}>
                    No storefronts match your search
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginTop: 4,
    padding: 4,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12,
    marginHorizontal: 16, marginTop: 10, marginBottom: 8,
  },
  content: { flex: 1, paddingHorizontal: 16 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
});
