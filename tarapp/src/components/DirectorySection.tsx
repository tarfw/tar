import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export interface DirectorySectionProps {
  entities: any[];
  theme: any;
  onSelectEntity: (entity: any) => void;
  onAddNewEntity: (category: 'people' | 'companies' | 'items') => void;
}

const PASTEL_COLORS = ['#ddd6fe', '#bae6fd', '#fef08a', '#e2e8f0', '#fed7aa', '#bbf7d0', '#fbcfe8'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PASTEL_COLORS[Math.abs(hash) % PASTEL_COLORS.length];
}

const ALLOWED_TYPES = [
  'customer', 'person', 'contact', 'staff', 'manager', 'admin',
  'company', 'business', 'vendor', 'partner', 'organization',
  'product', 'service', 'listing', 'item',
];

const COMPANY_TYPES = ['business', 'vendor', 'partner', 'company', 'companies', 'organization'];
const ITEM_TYPES = ['product', 'listing', 'service', 'item', 'items'];

export default function DirectorySection({
  entities,
  theme,
  onSelectEntity,
  onAddNewEntity,
}: DirectorySectionProps) {
  const [activeTab, setActiveTab] = useState<'people' | 'companies' | 'items'>('people');
  const [searchQuery, setSearchQuery] = useState('');

  const rawList = useMemo(() => {
    return entities
      .filter((d: any) => {
        const t = (d.type || d.category || '').toLowerCase();
        return ALLOWED_TYPES.includes(t) || !t;
      })
      .map((d, index) => {
        const typeStr = (d.type || d.category || '').toLowerCase();
        const cat: 'people' | 'companies' | 'items' = COMPANY_TYPES.includes(typeStr)
          ? 'companies'
          : ITEM_TYPES.includes(typeStr)
          ? 'items'
          : 'people';

        const displayName =
          d.title || d.name || d.data?.name || d.data?.title || (d.id ? `Record #${d.id}` : 'Untitled Entity');
        const rawCompany = d.company || d.data?.company || d.data?.org || '';
        const rawRole = d.type || d.role || (cat === 'items' ? 'Product' : 'Customer');

        return {
          id: d.id || `ent_${index}`,
          name: displayName,
          category: cat,
          subRole: rawRole === 'lead' ? 'Customer' : rawRole.charAt(0).toUpperCase() + rawRole.slice(1),
          company: rawCompany && rawCompany !== displayName ? rawCompany : d.price ? `₹${d.price}` : '',
          avatarColor: getAvatarColor(displayName),
          image: d.image || d.data?.image || d.data?.image_url || d.data?.thumbnail || d.data?.photo || '',
          raw: d,
        };
      });
  }, [entities]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rawList.filter((item) => {
      if (item.category !== activeTab) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.company.toLowerCase().includes(q) ||
        item.subRole.toLowerCase().includes(q)
      );
    });
  }, [rawList, activeTab, searchQuery]);

  const counts = useMemo(
    () => ({
      people: rawList.filter((r) => r.category === 'people').length,
      companies: rawList.filter((r) => r.category === 'companies').length,
      items: rawList.filter((r) => r.category === 'items').length,
    }),
    [rawList]
  );

  const tabs: Array<{ key: 'people' | 'companies' | 'items'; label: string }> = [
    { key: 'people', label: 'People' },
    { key: 'companies', label: 'Companies' },
    { key: 'items', label: 'Items' },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.searchBar, { backgroundColor: theme.border + '15', borderColor: theme.border + '40' }]}>
        <Ionicons name="search-outline" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={{ flex: 1, fontSize: 14, color: theme.text, paddingVertical: 8 }}
          placeholder={`Search ${activeTab}...`}
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8} style={{ marginRight: 8 }}>
            <Ionicons name="close-circle" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => onAddNewEntity(activeTab)}
          hitSlop={12}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            backgroundColor: theme.border + '30',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="add" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.tabsRow, { borderBottomColor: theme.border }]}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab.key} style={styles.tabButton} onPress={() => setActiveTab(tab.key)}>
            <Text style={[styles.tabText, { color: activeTab === tab.key ? theme.text : theme.textMuted }]}>
              {tab.label} ({counts[tab.key]})
            </Text>
            {activeTab === tab.key && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
          </TouchableOpacity>
        ))}
      </View>

      {filteredList.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            No {activeTab} records yet. Tap "+ New" to add one.
          </Text>
        </View>
      ) : (
        filteredList.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.7}
            onPress={() => onSelectEntity(item.raw)}
            style={[styles.itemRow, { borderBottomColor: theme.border }]}
          >
            {item.category === 'items' && item.image ? (
              <Image
                source={{ uri: item.image }}
                style={{ width: 38, height: 38, borderRadius: 6 }}
              />
            ) : item.category === 'companies' ? (
              <View style={[styles.companyAvatar, { backgroundColor: item.avatarColor }]}>
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase() || 'C'}</Text>
              </View>
            ) : (
              <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase() || 'P'}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.itemSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
                {item.company ? `${item.company} • ` : ''}
                {item.subRole}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  tabsRow: { flexDirection: 'row', borderBottomWidth: 1, gap: 20, paddingHorizontal: 4 },
  tabButton: { paddingVertical: 10, position: 'relative' },
  tabText: { fontSize: 13, fontWeight: '600' },
  activeIndicator: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2.5 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  companyAvatar: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#334155' },
  itemName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  itemSubtitle: { fontSize: 12 },
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center' },
});
