import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { SectionProps } from '../ComponentRegistry';

export interface EntityItem {
  id: string;
  name: string;
  category: 'people' | 'companies' | 'items';
  subRole?: string;
  company?: string;
  avatarColor?: string;
  icon?: string;
  metadata?: string;
}

const DEFAULT_ENTITIES: EntityItem[] = [
  // People
  { id: '1', name: 'Raven', category: 'people', subRole: 'Admin', company: 'Internal Team', avatarColor: '#e2e8f0' },
  { id: '2', name: '[Sample] Horace Hamill', category: 'people', subRole: 'Account manager', company: 'Globex Corp', avatarColor: '#ddd6fe' },
  { id: '3', name: '[Sample] Jonathon Kunde', category: 'people', subRole: 'Account Executive', company: 'Smyth Industries', avatarColor: '#bae6fd' },
  { id: '4', name: '[Sample] Alberto Ziemann', category: 'people', subRole: 'Sales Associate', company: 'Stark Enterprises', avatarColor: '#fef08a' },
  { id: '5', name: '[Sample] Terry Beier', category: 'people', subRole: 'Account manager', company: 'Omni Consumer Products', avatarColor: '#e2e8f0' },
  { id: '6', name: '[Sample] Stacey Schumm', category: 'people', subRole: 'Account manager', company: 'Wayne Enterprises', avatarColor: '#e2e8f0' },
  { id: '7', name: '[Sample] Doug Gottlieb', category: 'people', subRole: 'Sales Manager', company: 'Acme Corporation', avatarColor: '#ddd6fe' },
  { id: '8', name: '[Sample] Marilyn Fisher', category: 'people', subRole: 'Sales Rep', company: 'Cyberdyne Systems', avatarColor: '#bae6fd' },
  { id: '9', name: '[Sample] Vanessa Hickle', category: 'people', subRole: 'Sales Rep', company: 'Initech', avatarColor: '#fef08a' },

  // Companies
  { id: '10', name: 'Globex Corp', category: 'companies', subRole: 'Business Partner', company: 'Tier 1 Enterprise', avatarColor: '#fed7aa', icon: 'business-outline' },
  { id: '11', name: 'Smyth Industries', category: 'companies', subRole: 'Vendor', company: 'Hardware Supplier', avatarColor: '#e9d5ff', icon: 'business-outline' },
  { id: '12', name: 'Stark Enterprises', category: 'companies', subRole: 'Business', company: 'Tech Client', avatarColor: '#bfdbfe', icon: 'business-outline' },
  { id: '13', name: 'Acme Corporation', category: 'companies', subRole: 'Vendor', company: 'Logistics Partner', avatarColor: '#fef08a', icon: 'business-outline' },

  // Items
  { id: '14', name: 'Enterprise Cloud License', category: 'items', subRole: 'Product', company: '$499 / mo', avatarColor: '#bbf7d0', icon: 'cube-outline' },
  { id: '15', name: 'Real Estate Office Space #402', category: 'items', subRole: 'Listing', company: 'Lease Contract', avatarColor: '#fbcfe8', icon: 'home-outline' },
  { id: '16', name: 'Onboarding & Setup Consulting', category: 'items', subRole: 'Service', company: '$150 / hr', avatarColor: '#fed7aa', icon: 'calendar-outline' },
  { id: '17', name: 'Master SLA Agreement 2026', category: 'items', subRole: 'Document', company: 'Legal PDF', avatarColor: '#e2e8f0', icon: 'document-text-outline' },
];

const PASTEL_COLORS = ['#ddd6fe', '#bae6fd', '#fef08a', '#e2e8f0', '#fed7aa', '#bbf7d0', '#fbcfe8'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PASTEL_COLORS[Math.abs(hash) % PASTEL_COLORS.length];
}

export default function EntityDirectory({ props, designTokens, data, onExecuteAction }: SectionProps) {
  const { colors = {}, rounded = {} } = designTokens || {};
  const [activeTab, setActiveTab] = useState<'people' | 'companies' | 'items'>('people');
  const [searchQuery, setSearchQuery] = useState('');

  // Use passed data if provided, otherwise default sample data
  const rawList: EntityItem[] = useMemo(() => {
    if (data && Array.isArray(data) && data.length > 0) {
      return data.map((d, index) => ({
        id: d.id || `ent_${index}`,
        name: d.name || d.title || 'Untitled',
        category: (d.category || d.type === 'company' ? 'companies' : d.type === 'item' ? 'items' : 'people') as any,
        subRole: d.role || d.subRole || d.type || 'Entity',
        company: d.company || d.metadata || d.subtitle || '',
        avatarColor: d.avatarColor || getAvatarColor(d.name || ''),
        icon: d.icon,
      }));
    }
    return DEFAULT_ENTITIES;
  }, [data]);

  const filteredList = useMemo(() => {
    return rawList.filter((item) => {
      const matchesTab = item.category === activeTab;
      const matchesSearch =
        searchQuery.trim() === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.company && item.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.subRole && item.subRole.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesTab && matchesSearch;
    });
  }, [rawList, activeTab, searchQuery]);

  const handleAddPress = () => {
    if (onExecuteAction) {
      onExecuteAction('create_entity', { category: activeTab });
    } else {
      Alert.alert('Create New', `Add new ${activeTab.slice(0, -1)}`);
    }
  };

  const renderItem = ({ item }: { item: EntityItem }) => {
    const bgColor = item.avatarColor || getAvatarColor(item.name);
    const initial = item.name.replace(/^\[Sample\]\s*/, '').charAt(0).toUpperCase() || 'P';

    return (
      <Pressable
        style={({ pressed }) => [
          styles.itemRow,
          pressed && { backgroundColor: 'rgba(0,0,0,0.02)' },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: bgColor }]}>
          {item.icon ? (
            <Ionicons name={item.icon as any} size={18} color="#475569" />
          ) : (
            <Text style={styles.avatarText}>{initial}</Text>
          )}
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          {(item.company || item.subRole) && (
            <View style={styles.subtitleRow}>
              <Ionicons name="business-outline" size={13} color="#94a3b8" style={{ marginRight: 4 }} />
              <Text style={styles.itemSubtitle} numberOfLines={1}>
                {item.company}
                {item.company && item.subRole ? ' · ' : ''}
                {item.subRole}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </Pressable>
        )}
      </View>

      {/* Tabs Bar */}
      <View style={styles.tabsRow}>
        <Pressable
          style={[styles.tabButton, activeTab === 'people' && styles.tabActive]}
          onPress={() => setActiveTab('people')}
        >
          <Text style={[styles.tabText, activeTab === 'people' && styles.tabTextActive]}>
            People
          </Text>
          {activeTab === 'people' && <View style={styles.activeIndicator} />}
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'companies' && styles.tabActive]}
          onPress={() => setActiveTab('companies')}
        >
          <Text style={[styles.tabText, activeTab === 'companies' && styles.tabTextActive]}>
            Companies
          </Text>
          {activeTab === 'companies' && <View style={styles.activeIndicator} />}
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'items' && styles.tabActive]}
          onPress={() => setActiveTab('items')}
        >
          <Text style={[styles.tabText, activeTab === 'items' && styles.tabTextActive]}>
            Items
          </Text>
          {activeTab === 'items' && <View style={styles.activeIndicator} />}
        </Pressable>
      </View>

      {/* Entity List */}
      <View style={styles.listWrapper}>
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No {activeTab} found</Text>
            </View>
          }
        />
      </View>

      {/* Floating Action Button (+) */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
        ]}
        onPress={handleAddPress}
      >
        <Ionicons name="add" size={24} color="#ffffff" />
      </Pressable>
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
    position: 'relative',
    minHeight: 480,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    paddingHorizontal: 10,
    height: 40,
    marginBottom: 16,
    backgroundColor: '#ffffff',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    paddingVertical: 0,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 12,
    gap: 20,
  },
  tabButton: {
    paddingVertical: 8,
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#0f172a',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#0f172a',
  },
  listWrapper: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
});
