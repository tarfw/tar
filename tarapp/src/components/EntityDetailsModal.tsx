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
  Pressable,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { tar } from '@/lib/tar';

export interface EntityDetailsModalProps {
  visible: boolean;
  entity: any | null;
  scope?: string;
  theme: any;
  onClose: () => void;
  onRefresh?: () => void;
  onLogEventForEntity?: (entity: any, eventKind?: 'stage' | 'activity') => void;
}

function MiniTimeSlotGrid({
  selectedSlot,
  onSelectSlot,
  theme,
}: {
  selectedSlot: string;
  onSelectSlot: (slotStr: string) => void;
  theme: any;
}) {
  const slots = [
    '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
    '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM',
  ];

  return (
    <View style={{ marginTop: 8, marginBottom: 12 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        Time Slots
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {slots.map((slot) => {
          const isSelected = selectedSlot === slot;
          return (
            <TouchableOpacity
              key={slot}
              onPress={() => onSelectSlot(slot)}
              style={{
                width: '31%',
                paddingVertical: 7,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isSelected ? theme.primary : theme.border,
                backgroundColor: isSelected ? theme.primary : theme.backgroundElement,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: isSelected ? '700' : '500', color: isSelected ? '#ffffff' : theme.text }}>
                {slot}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
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
  const [notes, setNotes] = useState('');

  // Stage Bottom Drawer State
  const [showStageDrawer, setShowStageDrawer] = useState(false);
  const [selectedDrawerStage, setSelectedDrawerStage] = useState('Qualified');
  const [drawerNotes, setDrawerNotes] = useState('');
  const [submittingDrawerStage, setSubmittingDrawerStage] = useState(false);

  // New Interaction Modal & Icon Picker State (Matching Screenshots 1 & 2)
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [interactionTitle, setInteractionTitle] = useState('');
  const [interactionDateStr, setInteractionDateStr] = useState('');
  const [interactionDateValue, setInteractionDateValue] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [interactionDescription, setInteractionDescription] = useState('');
  const [selectedInteractionIcon, setSelectedInteractionIcon] = useState<{ name: string; isEmoji: boolean; color?: string }>({ name: 'calendar-outline', isEmoji: false });
  const [showIconPickerDrawer, setShowIconPickerDrawer] = useState(false);
  const [iconPickerTab, setIconPickerTab] = useState<'icons' | 'emojis'>('icons');
  const [submittingInteraction, setSubmittingInteraction] = useState(false);

  const CRM_STAGES = ['New Inquiry', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

  const INTERACTION_TYPES_ICONS = [
    { id: 'notes', name: 'document-text-outline' },
    { id: 'call', name: 'call-outline' },
    { id: 'people', name: 'people-outline' },
    { id: 'chat', name: 'chatbubble-outline' },
    { id: 'cafe', name: 'cafe-outline' },
    { id: 'restaurant', name: 'restaurant-outline' },
    { id: 'calendar', name: 'calendar-outline' },
    { id: 'wine', name: 'wine-outline' },
  ];

  const MESSAGING_APPS_ICONS = [
    { id: 'whatsapp', name: 'logo-whatsapp', color: '#25D366' },
    { id: 'twitter', name: 'logo-twitter', color: '#000000' },
    { id: 'linkedin', name: 'logo-linkedin', color: '#0A66C2' },
    { id: 'instagram', name: 'logo-instagram', color: '#E4405F' },
    { id: 'hangouts', name: 'chatbubbles-outline', color: '#0F9D58' },
    { id: 'tiktok', name: 'musical-notes-outline', color: '#000000' },
    { id: 'slack', name: 'logo-slack', color: '#4A154B' },
    { id: 'imessage', name: 'chatbubble-outline', color: '#34C759' },
    { id: 'messenger', name: 'logo-facebook', color: '#0084FF' },
    { id: 'signal', name: 'chatbox-outline', color: '#007AFF' },
    { id: 'discord', name: 'logo-discord', color: '#5865F2' },
    { id: 'wechat', name: 'logo-wechat', color: '#07C160' },
    { id: 'telegram', name: 'paper-plane-outline', color: '#0088cc' },
    { id: 'viber', name: 'call-outline', color: '#7360F2' },
  ];

  const POPULAR_EMOJIS = ['🤝', '📞', '📅', '📝', '☕', '🍴', '🥂', '💼', '💡', '🎯', '🚀', '🔥', '✅', '📍', '📧', '📱', '💬', '🏆', '🎉', '📌', '📎'];

  const formatDateString = (d: Date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[d.getDay()];
    const dateNum = String(d.getDate()).padStart(2, '0');
    const monthName = months[d.getMonth()];
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;
    return `${dayName}, ${dateNum} ${monthName}, ${hours}:${minutes} ${ampm}`;
  };

  const openInteractionModal = () => {
    const clientVal = company || entity?.data?.customer || entity?.data?.contact_id || entity?.data?.email || entity?.data?.company || '';
    setInteractionTitle(clientVal ? `Event with ${clientVal}` : `Event with ${entity?.name || 'Client'}`);
    const now = new Date();
    setInteractionDateValue(now);
    setInteractionDateStr(formatDateString(now));
    setShowDatePicker(false);
    setInteractionDescription('');
    setSelectedInteractionIcon({ name: 'calendar-outline', isEmoji: false });
    setShowIconPickerDrawer(false);
    setShowInteractionModal(true);
  };

  const handleSaveInteraction = async () => {
    if (!scope || !entity?.id) return;
    setSubmittingInteraction(true);
    try {
      const clientVal = company || entity?.data?.customer || entity?.data?.contact_id || entity?.data?.email || entity?.data?.company || '';
      await tar.tool('create', {
        table: 'motion',
        type: 'interaction',
        ref: entity.id,
        data: {
          title: interactionTitle.trim(),
          date_str: interactionDateStr,
          notes: interactionDescription.trim(),
          icon: selectedInteractionIcon.name,
          is_emoji: selectedInteractionIcon.isEmoji,
          client: clientVal,
          deal: entity.name || entity.title || '',
        },
        scope,
      });

      setShowInteractionModal(false);
      if (onRefresh) onRefresh();
      fetchLinkedMotions(entity.id);
    } catch (e) {
      console.warn('[EntityDetails] Save interaction error:', e);
    } finally {
      setSubmittingInteraction(false);
    }
  };



  const openStageDrawer = () => {
    const current = entity?.data?.stage || 'New Inquiry';
    const idx = CRM_STAGES.indexOf(current);
    const next = idx >= 0 && idx < CRM_STAGES.length - 2 ? CRM_STAGES[idx + 1] : current;
    setSelectedDrawerStage(next);
    setDrawerNotes('');
    setShowStageDrawer(true);
  };

  const handleSaveDrawerStage = async () => {
    if (!scope || !entity?.id) return;
    setSubmittingDrawerStage(true);
    try {
      await tar.tool('update', {
        table: 'matter',
        id: entity.id,
        scope,
        patch: {
          data: {
            ...(entity.data || {}),
            stage: selectedDrawerStage,
          },
        },
      });
      await tar.tool('create', {
        table: 'motion',
        type: 'stage',
        ref: entity.id,
        data: { stage: selectedDrawerStage, notes: drawerNotes.trim() },
        scope,
      });
      setShowStageDrawer(false);
      if (onRefresh) onRefresh();
      fetchLinkedMotions(entity.id);
    } catch (e) {
      console.warn('[EntityDetails] Update stage drawer error:', e);
    } finally {
      setSubmittingDrawerStage(false);
    }
  };

  useEffect(() => {
    if (entity) {
      setName(entity.name || entity.title || '');
      setSubRole(entity.subRole || entity.type || '');
      setCompany(
        entity.company ||
        entity.data?.company ||
        entity.data?.customer ||
        entity.data?.contact_id ||
        entity.data?.email ||
        ''
      );
      setValue(
        entity.value !== undefined && entity.value !== null && entity.value !== ''
          ? String(entity.value)
          : entity.data?.value !== undefined
          ? String(entity.data.value)
          : entity.data?.price
          ? String(entity.data.price)
          : ''
      );
      setNotes(entity.notes || entity.data?.notes || entity.data?.description || '');
      setIsEditing(false);
      setShowMenu(false);
      fetchLinkedMotions(entity.id);
    }
  }, [entity]);

  const getInitials = (str: string) => {
    if (!str || str === 'None') return '?';
    const parts = str.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getAvatarColor = (str: string) => {
    const colors = ['#6366f1', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#14b8a6'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

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

  const typeStr = (entity.type || entity.subRole || '').toLowerCase();
  const categoryName = entity.category || (
    ['lead', 'leads', 'prospect'].includes(typeStr) ? 'leads' :
    ['customer', 'staff', 'person', 'contact'].includes(typeStr) ? 'people' :
    ['company', 'business', 'vendor', 'partner', 'organization'].includes(typeStr) ? 'companies' : 'items'
  );

  const handleSaveUpdate = async () => {
    if (!scope || !entity?.id) return;
    setSaving(true);
    try {
      await tar.tool('update', {
        table: 'matter',
        id: entity.id,
        scope,
        patch: {
          title: name,
          type: subRole || entity.type,
          value: parseFloat(value) || 0,
          data: {
            ...(entity.data || {}),
            company,
            customer: company,
            notes,
            description: notes,
            subRole,
          },
        },
      });
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (e: any) {
      console.warn('[EntityDetails] Save update error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntity = () => {
    setShowMenu(false);
    Alert.alert(
      'Delete Entity',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!entity?.id) return;
            setDeleting(true);
            try {
              await Promise.all([
                tar.tool('delete', { table: 'matter', id: entity.id, scope: scope || '' }).catch(() => null),
                tar.tool('update', { table: 'matter', id: entity.id, scope: scope || '', type: entity.type || 'matter', patch: { status: 'deleted' } }).catch(() => null),
              ]);
            } catch (e: any) {
              console.warn('[EntityDetails] Delete matter error:', e);
            } finally {
              setDeleting(false);
              onClose();
              if (onRefresh) onRefresh();
            }
          },
        },
      ]
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
          {/* Details Scroll Area (No Top Bar Completely) */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollBody, { paddingTop: 16, paddingBottom: Math.max(insets.bottom + 24, 32) }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Hero Card Header (With Three-Dots Menu at Hero End, Zero Top Bar) */}
            {(() => {
              const clientVal = company || entity.data?.customer || entity.data?.contact_id || entity.data?.email || entity.data?.company || 'None';

              return (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <View style={{ flex: 1, gap: 3, paddingRight: 12 }}>
                    {isEditing ? (
                      <TextInput
                        style={{ fontSize: 20, fontWeight: '700', color: theme.text, paddingVertical: 0 }}
                        value={name}
                        onChangeText={setName}
                        placeholder="Deal Title..."
                        placeholderTextColor={theme.textMuted + '80'}
                      />
                    ) : (
                      <Text style={{ fontSize: 20, fontWeight: '700', color: theme.text }} numberOfLines={2}>
                        {name || 'Entity Details'}
                      </Text>
                    )}

                    {isEditing ? (
                      <>
                        <TextInput
                          style={{ fontSize: 13, color: theme.text, paddingVertical: 2 }}
                          value={company}
                          onChangeText={setCompany}
                          placeholder="Client name or company..."
                          placeholderTextColor={theme.textMuted + '80'}
                        />
                        {/* Value */}
                        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.textSecondary, marginTop: 2 }}>
                          {value ? `$ ${value}` : '$ 0'}
                        </Text>
                      </>
                    ) : clientVal !== 'None' ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: getAvatarColor(clientVal), alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>
                              {getInitials(clientVal)}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 20, fontWeight: '600', color: theme.text, textTransform: 'lowercase', flexShrink: 1 }} numberOfLines={1}>
                            {clientVal}
                          </Text>
                        </View>
                        {/* Value */}
                        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.textSecondary }}>
                          {value ? `$ ${value}` : '$ 0'}
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text style={{ fontSize: 13, color: theme.textMuted }}>
                          {subRole || categoryName || 'General Item'}
                        </Text>
                        {/* Value */}
                        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.textSecondary, marginTop: 2 }}>
                          {value ? `$ ${value}` : '$ 0'}
                        </Text>
                      </>
                    )}
                  </View>

                  {/* Three-Dots Menu at Hero End */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 }}>
                    {isEditing ? (
                      <>
                        <TouchableOpacity onPress={() => setIsEditing(false)} hitSlop={8}>
                          <Text style={{ fontSize: 15, color: theme.textSecondary }}>Cancel</Text>
                        </TouchableOpacity>
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
                      </>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setShowMenu(!showMenu)}
                        disabled={deleting}
                        hitSlop={12}
                        style={{ padding: 4 }}
                      >
                        {deleting ? (
                          <ActivityIndicator size="small" color="#dc2626" />
                        ) : (
                          <Ionicons name="ellipsis-vertical" size={20} color={theme.text} />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })()}

            {/* Stage Indicator (Crisp Visible Dividers) */}
            <TouchableOpacity
              onPress={openStageDrawer}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 12,
                borderTopColor: theme.border + '60',
                borderTopWidth: 1,
                borderBottomColor: theme.border + '60',
                borderBottomWidth: 1,
                marginVertical: 12,
              }}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={theme.primary} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>
                {entity.data?.stage || 'New Inquiry'}
              </Text>
            </TouchableOpacity>

            {/* Notes Section (Omitted for Deals in View Mode — Notes live dynamically in History timeline) */}
            {(() => {
              if (typeStr === 'deal' && !isEditing) return null;
              const notesDisplay = notes || entity.notes || entity.data?.notes || entity.data?.description || entity.data?.details || entity.data?.summary || '';
              if (!isEditing && !notesDisplay) {
                return (
                  <TouchableOpacity
                    onPress={() => setIsEditing(true)}
                    style={{ marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Ionicons name="add" size={14} color={theme.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.primary }}>
                      Add notes...
                    </Text>
                  </TouchableOpacity>
                );
              }
              return (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                    Notes
                  </Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.fieldInput, { color: theme.text, backgroundColor: theme.border + '15', borderRadius: 8, padding: 10, minHeight: 60 }]}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Notes or description..."
                      placeholderTextColor={theme.textMuted + '80'}
                      multiline
                    />
                  ) : (
                    <Text style={{ fontSize: 14, color: theme.text, lineHeight: 20 }}>
                      {notesDisplay}
                    </Text>
                  )}
                </View>
              );
            })()}

            {/* Events Timeline Section — Ultra Minimal Header with Icon Action */}
            <View style={styles.timelineSection}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Events
                </Text>
                <TouchableOpacity
                  onPress={openInteractionModal}
                  hitSlop={10}
                  style={{ padding: 2 }}
                >
                  <Ionicons name="add-circle-outline" size={21} color={theme.primary} />
                </TouchableOpacity>
              </View>

              {loadingMotions ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 16 }} />
              ) : linkedMotions.filter(m => (m.type || '').toLowerCase() !== 'change').length > 0 ? (
                <View style={{ gap: 12, marginTop: 4 }}>
                  {linkedMotions.filter(m => (m.type || '').toLowerCase() !== 'change').map((m, idx) => {
                    const mData = typeof m.data === 'string' ? (JSON.parse(m.data || '{}') || {}) : (m.data || {});
                    const iconName = mData.icon;
                    const isEmoji = mData.is_emoji;
                    const iconColor = mData.color;
                    const title = mData.title || (m.type === 'stage' && mData.stage ? `Stage: ${mData.stage}` : 'Event');
                    const dateStr = mData.date_str || m.timestamp || '';
                    const notesStr = mData.notes;

                    return (
                      <View
                        key={m.id || idx}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          gap: 12,
                          paddingVertical: 10,
                          borderBottomWidth: idx < linkedMotions.length - 1 ? StyleSheet.hairlineWidth : 0,
                          borderBottomColor: theme.border + '40',
                        }}
                      >
                        {/* Selected Icon Circle */}
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: theme.border + '15',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 1,
                          }}
                        >
                          {isEmoji ? (
                            <Text style={{ fontSize: 18 }}>{iconName}</Text>
                          ) : iconName ? (
                            <Ionicons name={iconName as any} size={20} color={iconColor || theme.text} />
                          ) : m.type === 'stage' ? (
                            <Ionicons name="pricetag-outline" size={18} color={theme.primary} />
                          ) : (
                            <Ionicons name="calendar-outline" size={18} color={theme.text} />
                          )}
                        </View>

                        {/* Event Details */}
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>
                            {title}
                          </Text>
                          {Boolean(dateStr) && (
                            <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textMuted }}>
                              {dateStr}
                            </Text>
                          )}
                          {Boolean(notesStr) && (
                            <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
                              {notesStr}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Minimal Three-Dots Floating Menu */}
        <Modal
          visible={showMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMenu(false)}
        >
          <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)}>
            <View style={[styles.menuContainer, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  setIsEditing(true);
                }}
              >
                <Ionicons name="create-outline" size={16} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>Edit Details</Text>
              </TouchableOpacity>

              <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleDeleteEntity}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* Stage Bottom Drawer Sheet */}
        <Modal
          visible={showStageDrawer}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowStageDrawer(false)}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              justifyContent: 'flex-end',
            }}
            onPress={() => setShowStageDrawer(false)}
          >
            <Pressable
              style={{
                backgroundColor: theme.background,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: Math.max(insets.bottom + 16, 20),
                borderTopWidth: 1,
                borderColor: theme.border,
                gap: 14,
                maxHeight: '85%',
              }}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Update Deal Stage</Text>
                <TouchableOpacity onPress={() => setShowStageDrawer(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Clean Vertical Stage List */}
              <View style={{ gap: 8 }}>
                {CRM_STAGES.map((stg) => {
                  const isSelected = selectedDrawerStage === stg;
                  return (
                    <TouchableOpacity
                      key={stg}
                      onPress={() => setSelectedDrawerStage(stg)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: isSelected ? theme.primary + '18' : theme.border + '15',
                        borderWidth: 1,
                        borderColor: isSelected ? theme.primary : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: isSelected ? '700' : '500', color: isSelected ? theme.primary : theme.text }}>
                        {stg}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Notes Input */}
              <TextInput
                style={{
                  color: theme.text,
                  backgroundColor: theme.border + '15',
                  borderRadius: 10,
                  padding: 12,
                  minHeight: 60,
                  fontSize: 14,
                }}
                value={drawerNotes}
                onChangeText={setDrawerNotes}
                placeholder="Notes..."
                placeholderTextColor={theme.textMuted + '80'}
                multiline
              />

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSaveDrawerStage}
                disabled={submittingDrawerStage}
                style={{
                  backgroundColor: theme.primary,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginTop: 4,
                }}
              >
                {submittingDrawerStage ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>
                    Advance Stage
                  </Text>
                )}
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>



        {/* Full-Screen / Sheet New Interaction Modal (Matching Screenshot 1) */}
        <Modal
          visible={showInteractionModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowInteractionModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: Math.max(insets.top, 16) }}>
            {/* Top Bar Header: ← Back Arrow | New interaction | Black Circle (✓) Checkmark Button */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 12,
            }}>
              <TouchableOpacity onPress={() => setShowInteractionModal(false)} hitSlop={12}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>

              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>
                New event
              </Text>

              {/* Black Circle Save Checkmark Button (Exact Screenshot 1 Design!) */}
              <TouchableOpacity
                onPress={handleSaveInteraction}
                disabled={submittingInteraction}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#000000',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {submittingInteraction ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Ionicons name="checkmark" size={24} color="#ffffff" />
                )}
              </TouchableOpacity>
            </View>

            {/* Interaction Form Content */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, gap: 24 }}>
              {/* Center Large Circular Icon Badge (FLAT — No Elevation / Shadow!) */}
              <View style={{ alignItems: 'center', marginVertical: 10 }}>
                <TouchableOpacity
                  onPress={() => setShowIconPickerDrawer(true)}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: theme.border + '15',
                    borderWidth: 1,
                    borderColor: theme.border + '30',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selectedInteractionIcon.isEmoji ? (
                    <Text style={{ fontSize: 32 }}>{selectedInteractionIcon.name}</Text>
                  ) : (
                    <Ionicons
                      name={selectedInteractionIcon.name as any}
                      size={32}
                      color={selectedInteractionIcon.color || theme.text}
                    />
                  )}
                </TouchableOpacity>
              </View>

              {/* Event Title Line (Auto-Prefilled) */}
              <TextInput
                style={{ fontSize: 18, fontWeight: '600', color: theme.text, paddingVertical: 4 }}
                value={interactionTitle}
                onChangeText={setInteractionTitle}
                placeholder="Event title..."
                placeholderTextColor={theme.textMuted + '80'}
              />

              {/* Date & Time Line (Click to open Native Expo UI Date & Time Picker!) */}
              <TouchableOpacity
                onPress={() => {
                  setDatePickerMode('date');
                  setShowDatePicker(true);
                }}
                style={{
                  paddingVertical: 14,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderColor: theme.border + '40',
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '500', color: theme.text }}>
                  {interactionDateStr}
                </Text>
              </TouchableOpacity>

              {/* Native Expo UI DateTimePicker (Sequential Date -> Time for Android!) */}
              {showDatePicker && (
                <DateTimePicker
                  value={interactionDateValue}
                  mode={Platform.OS === 'ios' ? 'datetime' : datePickerMode}
                  onChange={(evt: any, selectedDateObj?: Date) => {
                    if (evt.type === 'dismissed') {
                      setShowDatePicker(false);
                      return;
                    }
                    if (selectedDateObj) {
                      const updated = new Date(interactionDateValue);
                      if (Platform.OS === 'ios') {
                        setInteractionDateValue(selectedDateObj);
                        setInteractionDateStr(formatDateString(selectedDateObj));
                        setShowDatePicker(false);
                      } else if (datePickerMode === 'date') {
                        updated.setFullYear(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate());
                        setInteractionDateValue(updated);
                        setInteractionDateStr(formatDateString(updated));
                        setShowDatePicker(false);
                        setTimeout(() => {
                          setDatePickerMode('time');
                          setShowDatePicker(true);
                        }, 150);
                      } else {
                        updated.setHours(selectedDateObj.getHours(), selectedDateObj.getMinutes());
                        setInteractionDateValue(updated);
                        setInteractionDateStr(formatDateString(updated));
                        setShowDatePicker(false);
                      }
                    } else {
                      setShowDatePicker(false);
                    }
                  }}
                />
              )}

              {/* Description Input */}
              <TextInput
                style={{ fontSize: 15, color: theme.text, minHeight: 100, textAlignVertical: 'top' }}
                value={interactionDescription}
                onChangeText={setInteractionDescription}
                placeholder="Add a description"
                placeholderTextColor={theme.textMuted + '80'}
                multiline
              />
            </ScrollView>

            {/* Inline Icon Picker Drawer Overlay (NO SCROLLVIEW ZERO-HEIGHT COLLAPSE BUG ON ANDROID!) */}
            {showIconPickerDrawer && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  justifyContent: 'flex-end',
                  zIndex: 9999,
                }}
              >
                <Pressable style={{ flex: 1 }} onPress={() => setShowIconPickerDrawer(false)} />
                <View
                  style={{
                    backgroundColor: theme.background,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    paddingHorizontal: 24,
                    paddingTop: 20,
                    paddingBottom: Math.max(insets.bottom + 20, 24),
                    height: '65%',
                    gap: 16,
                  }}
                >
                  {/* Drawer Top Header: ✕ Close Icon | Select an Icon Title */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <TouchableOpacity onPress={() => setShowIconPickerDrawer(false)} hitSlop={10}>
                      <Ionicons name="close" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>
                      Select an icon
                    </Text>
                  </View>

                  {/* Tab Selector Bar: Icons | Emojis */}
                  <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.border + '30' }}>
                    <TouchableOpacity
                      onPress={() => setIconPickerTab('icons')}
                      style={{
                        paddingVertical: 10,
                        marginRight: 24,
                        borderBottomWidth: iconPickerTab === 'icons' ? 2 : 0,
                        borderBottomColor: theme.text,
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: iconPickerTab === 'icons' ? '700' : '500', color: iconPickerTab === 'icons' ? theme.text : theme.textMuted }}>
                        Icons
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setIconPickerTab('emojis')}
                      style={{
                        paddingVertical: 10,
                        borderBottomWidth: iconPickerTab === 'emojis' ? 2 : 0,
                        borderBottomColor: theme.text,
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: iconPickerTab === 'emojis' ? '700' : '500', color: iconPickerTab === 'emojis' ? theme.text : theme.textMuted }}>
                        Emojis
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Tab Content */}
                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 20, paddingBottom: 16 }}>
                    {iconPickerTab === 'icons' ? (
                      <>
                        {/* Category 1: Interaction types */}
                        <View style={{ gap: 12 }}>
                          <Text style={{ fontSize: 14, fontWeight: '500', color: theme.textMuted }}>
                            Interaction types
                          </Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
                            {INTERACTION_TYPES_ICONS.map((item) => (
                              <TouchableOpacity
                                key={item.id}
                                onPress={() => {
                                  setSelectedInteractionIcon({ name: item.name, isEmoji: false });
                                  setShowIconPickerDrawer(false);
                                }}
                                style={{ padding: 4 }}
                              >
                                <Ionicons name={item.name as any} size={24} color={theme.text} />
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        {/* Category 2: Messaging apps */}
                        <View style={{ gap: 12, marginTop: 8 }}>
                          <Text style={{ fontSize: 14, fontWeight: '500', color: theme.textMuted }}>
                            Messaging apps
                          </Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                            {MESSAGING_APPS_ICONS.map((app) => (
                              <TouchableOpacity
                                key={app.id}
                                onPress={() => {
                                  setSelectedInteractionIcon({ name: app.name, isEmoji: false, color: app.color });
                                  setShowIconPickerDrawer(false);
                                }}
                                style={{ padding: 4 }}
                              >
                                <Ionicons name={app.name as any} size={25} color={app.color} />
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </>
                    ) : (
                      /* Emojis Grid */
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                        {POPULAR_EMOJIS.map((emoji, idx) => (
                          <TouchableOpacity
                            key={idx}
                            onPress={() => {
                              setSelectedInteractionIcon({ name: emoji, isEmoji: true });
                              setShowIconPickerDrawer(false);
                            }}
                            style={{ padding: 4 }}
                          >
                            <Text style={{ fontSize: 24 }}>{emoji}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </ScrollView>
                </View>
              </View>
            )}
          </View>
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
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-start',
    paddingTop: 54,
    paddingRight: 16,
    alignItems: 'flex-end',
  },
  menuContainer: {
    width: 150,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  menuItemText: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
});
