import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
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
  type?: string;
  data?: any;
  value?: number;
}

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

  // Use passed data from Turso DB (`matter` rows)
  const rawList: EntityItem[] = useMemo(() => {
    if (data && Array.isArray(data) && data.length > 0) {
      return data.map((d, index) => {
        const typeStr = (d.type || d.category || '').toLowerCase();
        let cat: 'people' | 'companies' | 'items' = 'people';
        if (['business', 'vendor', 'partner', 'company', 'companies', 'organization'].includes(typeStr)) {
          cat = 'companies';
        } else if (['product', 'listing', 'service', 'document', 'asset', 'item', 'items', 'order', 'booking', 'expense', 'deal', 'project', 'shipment'].includes(typeStr)) {
          cat = 'items';
        } else {
          cat = 'people';
        }

        const displayName = d.title || d.name || d.data?.name || d.data?.title || (d.id ? `Record #${d.id}` : 'Untitled Entity');
        const displayCompany = d.company || d.data?.company || d.data?.email || d.data?.phone || d.data?.category || d.metadata || d.subtitle || '';

        return {
          id: d.id || `ent_${index}`,
          name: displayName,
          category: cat,
          subRole: d.type || d.role || d.subRole || 'Entity',
          company: displayCompany,
          avatarColor: d.avatarColor || getAvatarColor(displayName),
          icon: d.icon || (cat === 'companies' ? 'business-outline' : cat === 'items' ? 'cube-outline' : 'person-outline'),
          type: d.type,
          data: d.data,
          value: d.value,
        };
      });
    }
    return [];
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

  const handleRowPress = (item: EntityItem) => {
    if (onExecuteAction) {
      onExecuteAction('view_entity', { entity: item });
    }
  };

  const renderItem = ({ item }: { item: EntityItem }) => {
    const bgColor = item.avatarColor || getAvatarColor(item.name);
    const initial = item.name.charAt(0).toUpperCase() || 'E';

    return (
      <Pressable
        onPress={() => handleRowPress(item)}
        style={({ pressed }) => [
          styles.itemRow,
          pressed && { backgroundColor: 'rgba(0,0,0,0.03)' },
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
              <Ionicons name="information-circle-outline" size={13} color="#94a3b8" style={{ marginRight: 4 }} />
              <Text style={styles.itemSubtitle} numberOfLines={1}>
                {item.company}
                {item.company && item.subRole ? ' · ' : ''}
                {item.subRole}
              </Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Title & Add Button */}
      <View style={styles.headerRow}>
        <Text style={styles.directoryTitle}>Entity Directory</Text>
        <Pressable
          onPress={() => {
            if (onExecuteAction) {
              const actionName = activeTab === 'people' ? 'action_add_contact' : activeTab === 'companies' ? 'action_add_company' : 'action_add_product';
              onExecuteAction(actionName, { category: activeTab });
            }
          }}
          style={styles.addTextBtn}
        >
          <Ionicons name="add" size={15} color="#0f172a" />
          <Text style={styles.addText}>New {activeTab === 'people' ? 'Person' : activeTab === 'companies' ? 'Company' : 'Item'}</Text>
        </Pressable>
      </View>

      {/* Full-width Search Bar matching Workspace Input Bar UI */}
      <View style={{
        minHeight: 48,
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: -12,
        marginBottom: 8,
      }}>
        <Ionicons name="search-outline" size={17} color="#94a3b8" style={{ marginRight: 10 }} />
        <TextInput
          style={{ flex: 1, fontSize: 14, color: '#0f172a', paddingVertical: 12 }}
          placeholder="Search people, companies, items..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
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
              <Ionicons name="folder-open-outline" size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyText}>No {activeTab} records found</Text>
              <Text style={styles.emptySubText}>Create records or record event motions to populate this workspace directory.</Text>
            </View>
          }
        />
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
    minHeight: 380,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  addText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  directoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    marginBottom: 14,
    backgroundColor: '#ffffff',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
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
    fontSize: 14,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  emptySubText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
});
