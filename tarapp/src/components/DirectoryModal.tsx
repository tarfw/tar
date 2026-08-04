import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tar } from '@/lib/tar';

export interface DirectoryModalProps {
  visible: boolean;
  scope?: string;
  theme: any;
  onClose: () => void;
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

export default function DirectoryModal({
  visible,
  scope,
  theme,
  onClose,
  onSelectEntity,
  onAddNewEntity,
}: DirectoryModalProps) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'people' | 'companies' | 'items'>('people');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState<any[]>([]);

  const fetchMatterEntities = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    try {
      const res = await tar.tool('read', { table: 'matter', scope });
      const activeRows = (res?.rows || []).filter((r: any) => {
        if (!r) return false;
        const statusStr = String(r.status || r.data?.status || '').toLowerCase();
        const typeStr = String(r.type || '').toLowerCase();
        return (
          statusStr !== 'deleted' &&
          statusStr !== 'archived' &&
          statusStr !== 'converted' &&
          typeStr !== 'deleted' &&
          typeStr !== 'converted_lead' &&
          !r.deleted &&
          r.deleted !== 'true' &&
          r.is_deleted !== 1
        );
      });
      setEntities(activeRows);
    } catch (e) {
      console.warn('[DirectoryModal] Failed to read matter entities:', e);
      setEntities([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    if (visible && scope) {
      fetchMatterEntities();
    }
  }, [visible, scope, fetchMatterEntities]);

  const rawList = useMemo(() => {
    // Filter for People, Companies, and Items (Products & Services only)
    const allowedTypes = ['customer', 'person', 'contact', 'staff', 'manager', 'admin', 'company', 'business', 'vendor', 'partner', 'organization', 'product', 'service', 'listing', 'item'];
    const filteredEntities = entities.filter((d: any) => {
      const t = (d.type || d.category || '').toLowerCase();
      return allowedTypes.includes(t) || !t;
    });

    return filteredEntities.map((d, index) => {
      const typeStr = (d.type || d.category || '').toLowerCase();
      let cat: 'people' | 'companies' | 'items' = 'people';

      if (['business', 'vendor', 'partner', 'company', 'companies', 'organization'].includes(typeStr)) {
        cat = 'companies';
      } else if (['product', 'listing', 'service', 'item', 'items'].includes(typeStr)) {
        cat = 'items';
      } else {
        cat = 'people';
      }

      const displayName = d.title || d.name || d.data?.name || d.data?.title || (d.id ? `Record #${d.id}` : 'Untitled Entity');
      const rawCompany = d.company || d.data?.company || d.data?.org || '';
      const rawRole = d.type || d.role || d.subRole || (cat === 'items' ? 'Product' : 'Customer');
      
      const formattedRole = rawRole === 'lead' ? 'Customer' : rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
      const displayCompany = rawCompany && rawCompany !== displayName ? rawCompany : (d.price ? `₹${d.price}` : '');

      return {
        id: d.id || `ent_${index}`,
        name: displayName,
        category: cat,
        subRole: formattedRole,
        company: displayCompany,
        avatarColor: d.avatarColor || getAvatarColor(displayName),
        icon: d.icon || (cat === 'companies' ? 'business-outline' : cat === 'items' ? 'cube-outline' : 'person-outline'),
        type: d.type,
        data: d.data,
        value: d.value,
        raw: d,
      };
    });
  }, [entities]);

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

  if (!visible) return null;

  const renderItem = ({ item }: { item: any }) => {
    const initial = item.name.charAt(0).toUpperCase() || 'P';

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onSelectEntity(item.raw || item)}
        style={[styles.itemRow, { borderBottomColor: theme.border }]}
      >
        <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.itemSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
            {item.company ? `${item.company} • ` : ''}{item.subRole}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 12) }]}>
        {/* Top Header Bar (Noise-Free) */}
        <View style={[styles.headerBar, { borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.text, flex: 1 }]}>Directory</Text>

          {/* Right Text Button (+ New) */}
          <TouchableOpacity
            onPress={() => onAddNewEntity(activeTab)}
            hitSlop={8}
            style={styles.newTextBtn}
          >
            <Text style={[styles.newText, { color: theme.primary }]}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* High-Contrast Search Bar */}
        <View style={{
          minHeight: 48,
          backgroundColor: theme.border + '15',
          borderColor: theme.border + '40',
          borderTopWidth: 1,
          borderBottomWidth: 1,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 8,
        }}>
          <Ionicons name="search-outline" size={18} color={theme.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={{ flex: 1, fontSize: 15, color: theme.text, paddingVertical: 12 }}
            placeholder={`Search ${activeTab}...`}
            placeholderTextColor={theme?.dark ? '#a1a1aa' : '#52525b'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Clean Segmented Tabs Bar */}
        <View style={[styles.tabsRow, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'people' && styles.tabActive]}
            onPress={() => setActiveTab('people')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'people' ? theme.text : theme.textMuted }]}>
              People ({rawList.filter(r => r.category === 'people').length})
            </Text>
            {activeTab === 'people' && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'companies' && styles.tabActive]}
            onPress={() => setActiveTab('companies')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'companies' ? theme.text : theme.textMuted }]}>
              Companies ({rawList.filter(r => r.category === 'companies').length})
            </Text>
            {activeTab === 'companies' && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'items' && styles.tabActive]}
            onPress={() => setActiveTab('items')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'items' ? theme.text : theme.textMuted }]}>
              Items ({rawList.filter(r => r.category === 'items').length})
            </Text>
            {activeTab === 'items' && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
          </TouchableOpacity>
        </View>

        {/* List Content */}
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom + 24, 32) }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchMatterEntities} colors={[theme.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={42} color={theme.textMuted} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No {activeTab} records found</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                Tap "+ New" above to compose and add a new {activeTab.slice(0, -1)} record to this workspace.
              </Text>
              <TouchableOpacity
                onPress={() => onAddNewEntity(activeTab)}
                style={[styles.emptyCreateBtn, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="add" size={16} color="#ffffff" />
                <Text style={styles.emptyCreateBtnText}>Create First {activeTab.slice(0, -1)}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  newTextBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  newText: {
    fontSize: 17,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 20,
  },
  tabButton: {
    paddingVertical: 10,
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2.5,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyCreateBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
