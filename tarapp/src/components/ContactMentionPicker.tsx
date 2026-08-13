import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export interface MentionItem {
  id: string;
  name: string;
  type: string; // e.g. 'Customer', 'Product', 'Staff', 'Service'
  subtitle?: string;
  email?: string;
  phone?: string;
  role?: string;
  avatarColor?: string;
  rawEntity?: any;
  kind?: 'contact' | 'item';
}

export type ContactItem = MentionItem;

const PASTEL_COLORS = ['#3b82f6', '#ec4899', '#8b5cf6', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#14b8a6'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PASTEL_COLORS[Math.abs(hash) % PASTEL_COLORS.length];
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface ContactMentionPickerProps {
  visible: boolean;
  query: string;
  prefix?: '@' | '#';
  entities?: any[];
  theme: any;
  onSelectContact: (contact: MentionItem) => void;
  onOpenContactDetails?: (entity: any) => void;
  onClose: () => void;
  onOpenFullModal?: () => void;
  onAddNewContact?: () => void;
}

export function ContactMentionPicker(props: ContactMentionPickerProps) {
  const {
    visible,
    query,
    prefix = '@',
    entities = [],
    theme,
    onSelectContact,
    onClose,
  } = props;

  // Extract contacts (@) or items (#) from workspace entities (Deduplicated)
  const allItems = useMemo(() => {
    const parsed: MentionItem[] = [];
    const seenNames = new Set<string>();

    const isItemsMode = prefix === '#';

    const contactTypes = [
      'customer', 'person', 'contact', 'staff', 'manager', 'admin',
      'company', 'business', 'vendor', 'partner', 'user', 'client', 'team'
    ];

    const itemTypes = [
      'product', 'listing', 'service', 'item', 'items', 'inventory', 'sku', 'goods', 'order'
    ];

    (entities || []).forEach((e: any, index: number) => {
      const typeStr = (e.type || e.category || '').toLowerCase();

      if (isItemsMode) {
        // Items Mode (#)
        const isItemType = itemTypes.includes(typeStr) || (!contactTypes.includes(typeStr) && !typeStr);
        if (isItemType) {
          const name = e.title || e.name || e.data?.title || e.data?.name || (e.id ? `Item #${e.id}` : '');
          const normKey = name.toLowerCase().trim();
          if (name && !seenNames.has(normKey)) {
            seenNames.add(normKey);
            const price = e.price || e.data?.price ? `$${e.price || e.data?.price}` : '';
            const category = e.type || e.category || 'Product';
            parsed.push({
              id: e.id || `ent_item_${index}`,
              name,
              type: category,
              subtitle: price ? `${category} • ${price}` : category,
              rawEntity: e,
              kind: 'item',
            });
          }
        }
      } else {
        // Contacts Mode (@)
        const isContactType = contactTypes.includes(typeStr) || !typeStr;
        if (isContactType) {
          const name = e.name || e.title || e.data?.name || e.data?.title || '';
          const normKey = name.toLowerCase().trim();
          if (name && !seenNames.has(normKey)) {
            seenNames.add(normKey);
            parsed.push({
              id: e.id || `ent_contact_${index}`,
              name,
              type: e.type || e.category || 'Customer',
              subtitle: e.type || e.category || 'Customer',
              avatarColor: getAvatarColor(name),
              rawEntity: e,
              kind: 'contact',
            });
          }
        }
      }
    });

    return parsed;
  }, [entities, prefix]);

  // Filter by search query after @ or #
  const filteredItems = useMemo(() => {
    const cleanQuery = (query || '').toLowerCase().trim();
    if (!cleanQuery) return allItems;
    return allItems.filter(c =>
      c.name.toLowerCase().includes(cleanQuery) ||
      (c.type && c.type.toLowerCase().includes(cleanQuery)) ||
      (c.subtitle && c.subtitle.toLowerCase().includes(cleanQuery))
    );
  }, [allItems, query]);

  if (!visible) return null;

  const isItemsMode = prefix === '#';

  const handleRowPress = (item: MentionItem) => {
    if (props.onOpenContactDetails) {
      props.onOpenContactDetails(item.rawEntity || {
        id: item.id,
        title: item.name,
        name: item.name,
        type: item.type,
        category: item.type?.toLowerCase() || (item.kind === 'item' ? 'product' : 'customer'),
        kind: item.kind,
        data: { name: item.name, type: item.type }
      });
    } else {
      onSelectContact(item);
    }
  };

  return (
    <View style={[styles.popoverContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
      {/* Pure List */}
      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="always"
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 8 }}
        nestedScrollEnabled={true}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.contactRow, { borderBottomColor: theme.border + '20' }]}
            onPress={() => handleRowPress(item)}
            activeOpacity={0.7}
          >
            {/* Avatar for Contact / Icon for Item */}
            {isItemsMode ? (
              <View style={[styles.avatar, { backgroundColor: theme.primary + '18' }]}>
                <Ionicons name="cube-outline" size={16} color={theme.primary} />
              </View>
            ) : (
              <View style={[styles.avatar, { backgroundColor: item.avatarColor || theme.primary }]}>
                <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
              </View>
            )}

            {/* Name + Subtitle (Type or Price) */}
            <View style={styles.contactDetails}>
              <Text style={[styles.contactName, { color: theme.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.contactSub, { color: theme.textMuted }]} numberOfLines={1}>
                {item.subtitle || item.type}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              {isItemsMode
                ? `No items matching "#${query}"`
                : `No contacts matching "@${query}"`}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

// Standalone Modal Version
interface ContactMentionModalProps {
  visible: boolean;
  prefix?: '@' | '#';
  entities?: any[];
  theme: any;
  onSelectContact: (contact: MentionItem) => void;
  onOpenContactDetails?: (entity: any) => void;
  onClose: () => void;
  onAddNewContact?: () => void;
}

export function ContactMentionModal(props: ContactMentionModalProps) {
  const {
    visible,
    prefix = '@',
    entities = [],
    theme,
    onSelectContact,
    onClose,
  } = props;

  const [search, setSearch] = React.useState('');

  const isItemsMode = prefix === '#';

  const allItems = useMemo(() => {
    const parsed: MentionItem[] = [];
    const seenNames = new Set<string>();

    const contactTypes = [
      'customer', 'person', 'contact', 'staff', 'manager', 'admin',
      'company', 'business', 'vendor', 'partner', 'user', 'client', 'team'
    ];

    const itemTypes = [
      'product', 'listing', 'service', 'item', 'items', 'inventory', 'sku', 'goods', 'order'
    ];

    (entities || []).forEach((e: any, index: number) => {
      const typeStr = (e.type || e.category || '').toLowerCase();

      if (isItemsMode) {
        const isItemType = itemTypes.includes(typeStr) || (!contactTypes.includes(typeStr) && !typeStr);
        if (isItemType) {
          const name = e.title || e.name || e.data?.title || e.data?.name || (e.id ? `Item #${e.id}` : '');
          const normKey = name.toLowerCase().trim();
          if (name && !seenNames.has(normKey)) {
            seenNames.add(normKey);
            const price = e.price || e.data?.price ? `$${e.price || e.data?.price}` : '';
            const category = e.type || e.category || 'Product';
            parsed.push({
              id: e.id || `modal_item_${index}`,
              name,
              type: category,
              subtitle: price ? `${category} • ${price}` : category,
              rawEntity: e,
              kind: 'item',
            });
          }
        }
      } else {
        const isContactType = contactTypes.includes(typeStr) || !typeStr;
        if (isContactType) {
          const name = e.name || e.title || e.data?.name || e.data?.title || '';
          const normKey = name.toLowerCase().trim();
          if (name && !seenNames.has(normKey)) {
            seenNames.add(normKey);
            parsed.push({
              id: e.id || `modal_contact_${index}`,
              name,
              type: e.type || e.category || 'Customer',
              subtitle: e.type || e.category || 'Customer',
              avatarColor: getAvatarColor(name),
              rawEntity: e,
              kind: 'contact',
            });
          }
        }
      }
    });

    return parsed;
  }, [entities, isItemsMode]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allItems;
    return allItems.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.type && c.type.toLowerCase().includes(q))
    );
  }, [allItems, search]);

  const handleModalRowPress = (item: MentionItem) => {
    onClose();
    if (props.onOpenContactDetails) {
      props.onOpenContactDetails(item.rawEntity || {
        id: item.id,
        title: item.name,
        name: item.name,
        type: item.type,
        category: item.type?.toLowerCase() || (item.kind === 'item' ? 'product' : 'customer'),
        kind: item.kind,
        data: { name: item.name, type: item.type }
      });
    } else {
      onSelectContact(item);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.border + '40' }]}>
            <View style={styles.modalTitleRow}>
              <View style={[styles.atBadge, { backgroundColor: theme.primary + '18' }]}>
                <Text style={[styles.atBadgeText, { color: theme.primary }]}>{prefix}</Text>
              </View>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {isItemsMode ? 'Items & Products' : 'Contacts'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeCircle}>
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Ionicons name="search" size={16} color={theme.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder={isItemsMode ? "Search items & products..." : "Search contacts..."}
              placeholderTextColor={theme.textMuted}
              autoFocus
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Clean List */}
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalContactRow, { borderBottomColor: theme.border + '20' }]}
                onPress={() => handleModalRowPress(item)}
                activeOpacity={0.7}
              >
                {isItemsMode ? (
                  <View style={[styles.avatar, { backgroundColor: theme.primary + '18' }]}>
                    <Ionicons name="cube-outline" size={16} color={theme.primary} />
                  </View>
                ) : (
                  <View style={[styles.avatar, { backgroundColor: item.avatarColor || theme.primary }]}>
                    <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                  </View>
                )}

                <View style={styles.contactDetails}>
                  <Text style={[styles.contactName, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[styles.contactSub, { color: theme.textMuted }]}>{item.subtitle || item.type}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  {isItemsMode ? 'No items found' : 'No contacts found'}
                </Text>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  popoverContainer: {
    maxHeight: 280,
    borderTopWidth: 1,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderRadius: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  list: {
    maxHeight: 275,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  contactDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
  },
  contactSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '400',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderRadius: 0,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  atBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeCircle: {
    padding: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  modalContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
