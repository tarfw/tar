import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tar } from '@/lib/tar';

export interface EntityDetailsModalProps {
  visible: boolean;
  entity: any | null;
  scope?: string;
  theme: any;
  onClose: () => void;
  onRefresh?: () => void;
  onLogEventForEntity?: (entity: any) => void;
}

export default function EntityDetailsModal({
  visible,
  entity,
  scope,
  theme,
  onClose,
  onRefresh,
  onLogEventForEntity,
}: EntityDetailsModalProps) {
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingMotions, setLoadingMotions] = useState(false);
  const [linkedMotions, setLinkedMotions] = useState<any[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  // Form edit fields
  const [name, setName] = useState('');
  const [subRole, setSubRole] = useState('');
  const [company, setCompany] = useState('');
  const [value, setValue] = useState('');

  useEffect(() => {
    if (entity) {
      setName(entity.name || entity.title || '');
      setSubRole(entity.subRole || entity.type || '');
      setCompany(entity.company || entity.data?.company || entity.data?.email || '');
      setValue(entity.value ? String(entity.value) : entity.data?.price ? String(entity.data.price) : '');
      setIsEditing(false);
      setShowMenu(false);
      fetchLinkedMotions(entity.id);
    }
  }, [entity]);

  const fetchLinkedMotions = async (entityId: string) => {
    if (!scope || !entityId) return;
    setLoadingMotions(true);
    try {
      const res = await tar.tool('read', { table: 'motion', ref: entityId, scope });
      setLinkedMotions(res?.rows || []);
    } catch (e) {
      console.warn('[EntityDetails] Failed to fetch linked motions:', e);
      setLinkedMotions([]);
    } finally {
      setLoadingMotions(false);
    }
  };

  if (!visible || !entity) return null;

  const categoryName = entity.category || (entity.type === 'product' || entity.type === 'service' ? 'items' : entity.type === 'customer' ? 'people' : 'items');

  const handleSaveUpdate = async () => {
    if (!scope || !entity?.id) return;
    setSaving(true);
    try {
      await tar.tool('update', {
        table: 'matter',
        id: entity.id,
        scope,
        type: entity.type || 'matter',
        patch: {
          title: name,
          type: subRole || entity.type,
          value: parseFloat(value) || entity.value || 0,
          data: {
            ...(entity.data || {}),
            company,
            subRole,
          },
        },
      });
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Could not save entity details');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntity = () => {
    setShowMenu(false);
    Alert.alert(
      'Delete Entity',
      `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!scope || !entity?.id) return;
            setDeleting(true);
            try {
              await tar.tool('delete', { table: 'matter', id: entity.id, scope });
              onClose();
              if (onRefresh) onRefresh();
            } catch (e: any) {
              Alert.alert('Delete Failed', e.message || 'Could not delete entity');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleViewMetadata = () => {
    setShowMenu(false);
    Alert.alert(
      'Entity Metadata Card',
      JSON.stringify(entity.data || entity, null, 2),
      [{ text: 'Close' }]
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Top Bar with Title and Three-Dots Menu */}
          <View style={[styles.headerBar, { borderBottomColor: theme.border }]}>
            <View style={styles.headerLeft}>
              {isEditing && (
                <TouchableOpacity onPress={() => setIsEditing(false)} hitSlop={8} style={{ marginRight: 8 }}>
                  <Text style={{ fontSize: 16, color: theme.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
              )}
              <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
                {name || 'Entity Details'}
              </Text>
            </View>

            <View style={styles.headerRight}>
              {isEditing ? (
                <TouchableOpacity
                  onPress={handleSaveUpdate}
                  disabled={saving}
                  hitSlop={8}
                  style={styles.actionTextBtn}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Text style={[styles.actionText, { color: theme.primary }]}>Save</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowMenu(!showMenu)}
                  disabled={deleting}
                  hitSlop={8}
                  style={{ padding: 4 }}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#dc2626" />
                  ) : (
                    <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Details Scroll Area */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollBody, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Structured Fields Section */}
            <View style={styles.fieldsSection}>
              {/* Field: Name */}
              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Name</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.fieldInput, { color: theme.text }]}
                    value={name}
                    onChangeText={setName}
                    placeholder="Entity Name"
                    placeholderTextColor={theme.textMuted + '80'}
                  />
                ) : (
                  <Text style={[styles.fieldTextValue, { color: theme.text, fontWeight: '600' }]}>{name}</Text>
                )}
              </View>

              {/* Field: Category */}
              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Category</Text>
                <Text style={[styles.fieldTextValue, { color: theme.text, textTransform: 'capitalize' }]}>
                  {categoryName}
                </Text>
              </View>

              {/* Field: Role / SubType */}
              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Role/Type</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.fieldInput, { color: theme.text }]}
                    value={subRole}
                    onChangeText={setSubRole}
                    placeholder="Staff / Customer / Product / Vendor..."
                    placeholderTextColor={theme.textMuted + '80'}
                  />
                ) : (
                  <Text style={[styles.fieldTextValue, { color: theme.text }]}>{subRole || 'Default'}</Text>
                )}
              </View>

              {/* Field: Organization / Subtitle */}
              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Details</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.fieldInput, { color: theme.text }]}
                    value={company}
                    onChangeText={setCompany}
                    placeholder="Company, Email, or Metadata..."
                    placeholderTextColor={theme.textMuted + '80'}
                  />
                ) : (
                  <Text style={[styles.fieldTextValue, { color: theme.text }]}>{company || 'None'}</Text>
                )}
              </View>

              {/* Field: Value / Amount */}
              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Value</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.fieldInput, { color: theme.text, fontWeight: '600' }]}
                    value={value}
                    keyboardType="numeric"
                    onChangeText={setValue}
                    placeholder="Price, Stock, or Amount..."
                    placeholderTextColor={theme.textMuted + '80'}
                  />
                ) : (
                  <Text style={[styles.fieldTextValue, { color: theme.text, fontWeight: '600' }]}>
                    {value ? `$ ${value}` : 'N/A'}
                  </Text>
                )}
              </View>
            </View>

            {/* Event History Motion Section — Minimal Simple Text List */}
            <View style={styles.timelineSection}>
              <View style={styles.timelineHeaderRow}>
                <Text style={[styles.sectionHeading, { color: theme.text }]}>Event History Motion</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (onLogEventForEntity) {
                      onLogEventForEntity(entity);
                    }
                  }}
                  hitSlop={8}
                  style={styles.addEventTextBtn}
                >
                  <Ionicons name="add" size={15} color={theme.primary} />
                  <Text style={[styles.addEventText, { color: theme.primary }]}>Event</Text>
                </TouchableOpacity>
              </View>

              {loadingMotions ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 16 }} />
              ) : linkedMotions.length > 0 ? (
                linkedMotions.map((m, idx) => (
                  <View key={m.id || idx} style={[styles.motionRow, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.motionTitle, { color: theme.text }]}>
                      {m.type ? m.type.toUpperCase() : 'EVENT'}
                    </Text>
                    <Text style={[styles.motionSub, { color: theme.textMuted }]}>
                      {m.by ? `By ${m.by} • ` : ''}{m.timestamp || 'recent'}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyTimelineText, { color: theme.textMuted }]}>
                  No events recorded yet
                </Text>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Three Dotted Options Drawer / Action Sheet Menu */}
        <Modal
          visible={showMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMenu(false)}
        >
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          >
            <View style={[styles.menuContainer, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: theme.border }]}
                onPress={() => {
                  setShowMenu(false);
                  setIsEditing(true);
                }}
              >
                <Ionicons name="create-outline" size={18} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>Edit Entity Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: theme.border }]}
                onPress={handleViewMetadata}
              >
                <Ionicons name="card-outline" size={18} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>View Metadata Card</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleDeleteEntity}
              >
                <Ionicons name="trash-outline" size={18} color="#dc2626" />
                <Text style={[styles.menuItemText, { color: '#dc2626' }]}>Delete Entity</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionTextBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 17,
    fontWeight: '600',
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  fieldsSection: {
    marginBottom: 24,
  },
  fieldRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  fieldLabel: {
    width: 80,
    fontSize: 14,
    fontWeight: '500',
  },
  fieldTextValue: {
    flex: 1,
    fontSize: 15,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  timelineSection: {
    marginTop: 8,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  addEventTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addEventText: {
    fontSize: 14,
    fontWeight: '600',
  },
  motionRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  motionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  motionSub: {
    fontSize: 12,
  },
  emptyTimelineText: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    paddingTop: 60,
    paddingRight: 16,
    alignItems: 'flex-end',
  },
  menuContainer: {
    width: 200,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
