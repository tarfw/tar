import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tar } from '@/lib/tar';

export interface WorkspaceItem {
  subdomain: string;
  scope: string;
  type: string;
  name: string;
  description: string;
  mockProducts?: Array<{ id: string; title: string; price: number }>;
}

export interface ExploreModalProps {
  visible: boolean;
  theme: any;
  onClose: () => void;
  onSelectWorkspace?: (workspace: WorkspaceItem) => void;
}

const VERTICAL_COLORS: Record<string, { bg: string; text: string }> = {
  bakery: { bg: '#fff1f2', text: '#e11d48' },
  taxi: { bg: '#eff6ff', text: '#2563eb' },
  beauty: { bg: '#faf5ff', text: '#9333ea' },
  retail: { bg: '#ecfdf5', text: '#059669' },
  restaurant: { bg: '#fef3c7', text: '#d97706' },
};

function getVerticalEmoji(type: string): string {
  const map: Record<string, string> = {
    bakery: '🍪',
    taxi: '🚕',
    beauty: '💇',
    retail: '🛍️',
    restaurant: '🍽️',
  };
  return map[type] || '✨';
}

const MOCK_PUBLIC_WORKSPACES: WorkspaceItem[] = [
  {
    subdomain: 'croissant-bakery',
    scope: 's:croissant-bakery',
    type: 'bakery',
    name: 'Croissant & Cafe',
    description: 'Artisanal French pastries, fresh sourdough bread, and premium coffee.',
    mockProducts: [
      { id: 'p1', title: 'Almond Croissant', price: 180 },
      { id: 'p2', title: 'Sourdough Loaf', price: 240 },
      { id: 'p3', title: 'Pain au Chocolat', price: 160 },
      { id: 'p4', title: 'Flat White Coffee', price: 150 },
    ]
  },
  {
    subdomain: 'mumbai-cabs',
    scope: 's:mumbai-cabs',
    type: 'taxi',
    name: 'Mumbai Taxis',
    description: 'Reliable, instant taxi bookings and airport transfers across Mumbai.',
    mockProducts: []
  },
  {
    subdomain: 'grand-salon',
    scope: 's:grand-salon',
    type: 'beauty',
    name: 'Grand Salon & Spa',
    description: 'Premium haircuts, therapeutic spa body treatments, and luxury wellness.',
    mockProducts: []
  },
  {
    subdomain: 'streetwear-co',
    scope: 's:streetwear-co',
    type: 'retail',
    name: 'Streetwear Co.',
    description: 'Limited edition oversized tees, hoodies, and accessories.',
    mockProducts: [
      { id: 'r1', title: 'Heavyweight Black Hoodie', price: 1800 },
      { id: 'r2', title: 'Oversized Cargo Pants', price: 2200 },
      { id: 'r3', title: 'Vintage Graphic Tee', price: 950 },
    ]
  }
];

export default function ExploreModal({
  visible,
  theme,
  onClose,
  onSelectWorkspace,
}: ExploreModalProps) {
  const insets = useSafeAreaInsets();
  const [workspacesList, setWorkspacesList] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tar.listWorkspaces().catch(() => ({ workspaces: [] }));
      const userSubdomains = new Set(res.workspaces?.map((w: any) => w.subdomain) || []);

      const systemWorkspaces: WorkspaceItem[] = (res.workspaces || [])
        .filter((w: any) => !userSubdomains.has(w.subdomain))
        .map((w: any) => ({
          subdomain: w.subdomain,
          scope: w.scope,
          type: w.type || 'business',
          name: w.name || w.subdomain,
          description: `${w.type || 'Business'} services and storefront.`,
        }));

      const merged = [...systemWorkspaces];
      MOCK_PUBLIC_WORKSPACES.forEach((mock) => {
        if (!userSubdomains.has(mock.subdomain)) {
          merged.push(mock);
        }
      });

      setWorkspacesList(merged);
    } catch (e) {
      console.warn('[ExploreModal] Failed to load workspaces:', e);
      setWorkspacesList(MOCK_PUBLIC_WORKSPACES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadWorkspaces();
    }
  }, [visible, loadWorkspaces]);

  const filteredWorkspaces = workspacesList.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.type === selectedCategory;
    const matchesQuery = !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'bakery', label: 'Bakery' },
    { id: 'retail', label: 'Retail' },
    { id: 'beauty', label: 'Beauty & Spa' },
    { id: 'taxi', label: 'Transport' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Explore</Text>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: theme.backgroundElement }]}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Full-width Search Bar matching Workspace Input Bar UI */}
        <View style={{
          minHeight: 48,
          backgroundColor: theme.background,
          borderColor: theme.border,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 8,
        }}>
          <Ionicons name="search-outline" size={17} color={theme.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={{ flex: 1, fontSize: 14, color: theme.text, paddingVertical: 12 }}
            placeholder="Search storefronts or services..."
            placeholderTextColor={theme.textMuted + '80'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Minimal Category Chips */}
        <View style={styles.categoryContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {categories.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  activeOpacity={0.7}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: active ? theme.text : 'transparent',
                      borderColor: active ? theme.text : theme.border + '60',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryLabel,
                      { color: active ? theme.background : theme.textSecondary, fontWeight: active ? '600' : '400' },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Content List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 8 }}>Loading...</Text>
          </View>
        ) : filteredWorkspaces.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="search-outline" size={36} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No matching storefronts</Text>
          </View>
        ) : (
          <FlatList
            data={filteredWorkspaces}
            keyExtractor={(item) => item.subdomain}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom + 24, 32) }}
            renderItem={({ item }) => {
              const emoji = getVerticalEmoji(item.type);

              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    if (onSelectWorkspace) {
                      onSelectWorkspace(item);
                    }
                    onClose();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.border,
                  }}
                >
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: theme.primary + '15',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    <Text style={{ fontSize: 20 }}>{emoji}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text, marginBottom: 2 }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: 13, color: theme.textMuted }} numberOfLines={1}>
                      {item.description || `${item.type.toUpperCase()} • ${item.subdomain}`}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  categoryContainer: {
    paddingVertical: 4,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  categoryLabel: {
    fontSize: 12,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  cardDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  productsRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  miniProductTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 6,
  },
  miniProductTitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  miniProductPrice: {
    fontSize: 11,
    fontWeight: '700',
  },
});
