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
  onAddDeal?: (contactEntity: any) => void;
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

export default function ContactDetailsModal({
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
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [linkedDeals, setLinkedDeals] = useState<any[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  // Form edit fields
  const [name, setName] = useState('');
  const [subRole, setSubRole] = useState('');
  const [company, setCompany] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');

  // New Interaction Modal & Icon Picker State (Matching Screenshots 1 & 2)
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [interactionTitle, setInteractionTitle] = useState('');
  const [interactionDateStr, setInteractionDateStr] = useState('');
  const [interactionDateValue, setInteractionDateValue] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [interactionDescription, setInteractionDescription] = useState('');
  const [showIconPickerDrawer, setShowIconPickerDrawer] = useState(false);
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

  const DEAL_STAGE_ICONS = [
    { id: 'new_inquiry', stageName: 'New Inquiry', icon: 'checkmark-circle-outline', isEmoji: false, color: '#3B82F6' },
    { id: 'qualified', stageName: 'Qualified', icon: 'ribbon-outline', isEmoji: false, color: '#06B6D4' },
    { id: 'proposal', stageName: 'Proposal', icon: 'document-text-outline', isEmoji: false, color: '#8B5CF6' },
    { id: 'negotiation', stageName: 'Negotiation', icon: 'disc-outline', isEmoji: false, color: '#F59E0B' },
    { id: 'closed_won', stageName: 'Closed Won', icon: '🎉', isEmoji: true, color: '#10B981' },
    { id: 'closed_lost', stageName: 'Closed Lost', icon: 'close-circle-outline', isEmoji: false, color: '#EF4444' },
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

  const compactTimestamp = (rawStr: string) => {
    if (!rawStr) return '';
    try {
      const d = new Date(rawStr);
      if (isNaN(d.getTime())) {
        // If it's already a formatted string like "Tuesday, 04 Aug, 12:20 am", simplify it!
        return rawStr.replace(/^[A-Za-z]+,\s*/, ''); // removes Day name like "Tuesday, " -> "04 Aug, 12:20 am"
      }
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();

      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const timePart = `${hours}:${minutes} ${ampm}`;

      if (isToday) return `Today ${timePart}`;
      if (isYesterday) return `Yesterday ${timePart}`;

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateNum = String(d.getDate()).padStart(2, '0');
      const monthName = months[d.getMonth()];
      return `${dateNum} ${monthName}, ${timePart}`;
    } catch {
      return rawStr;
    }
  };

  const [selectedInteractionIcon, setSelectedInteractionIcon] = useState<{ name: string; isEmoji: boolean; color?: string; stageName?: string }>({ name: 'calendar-outline', isEmoji: false });

  const openInteractionModal = (autoOpenSelector = false) => {
    const clientVal = company || entity?.data?.customer || entity?.data?.contact_id || entity?.data?.email || entity?.data?.company || '';
    setInteractionTitle(clientVal ? `Event with ${clientVal}` : `Event with ${entity?.name || 'Client'}`);
    const now = new Date();
    setInteractionDateValue(now);
    setInteractionDateStr(formatDateString(now));
    setShowDatePicker(false);
    setInteractionDescription('');
    setSelectedInteractionIcon({ name: 'calendar-outline', isEmoji: false });
    setShowIconPickerDrawer(autoOpenSelector);
    setShowInteractionModal(true);
  };

  const handleSaveInteraction = async () => {
    if (!scope || !entity?.id) return;
    setSubmittingInteraction(true);
    try {
      const clientVal = company || entity?.data?.customer || entity?.data?.contact_id || entity?.data?.email || entity?.data?.company || '';
      
      // If a pipeline stage icon was chosen, update the entity's stage on the matter table & local state instantly!
      if (selectedInteractionIcon.stageName) {
        if (entity.data) {
          entity.data.stage = selectedInteractionIcon.stageName;
        }
        await tar.tool('update', {
          table: 'matter',
          id: entity.id,
          scope,
          patch: {
            data: {
              ...(entity.data || {}),
              stage: selectedInteractionIcon.stageName,
            },
          },
        });
      }

      await tar.tool('create', {
        table: 'motion',
        type: selectedInteractionIcon.stageName ? 'stage' : 'interaction',
        ref: entity.id,
        data: {
          title: interactionTitle.trim(),
          date_str: interactionDateStr,
          notes: interactionDescription.trim(),
          icon: selectedInteractionIcon.name,
          is_emoji: selectedInteractionIcon.isEmoji,
          stage: selectedInteractionIcon.stageName || entity?.data?.stage,
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
      fetchLinkedMotions(entity.id);
      fetchLinkedDeals(entity.id);
    }
  }, [entity]);

  const fetchLinkedDeals = async (entityId: string) => {
    if (!scope || !entityId) return;
    setLoadingDeals(true);
    try {
      // Query graph or matter for deals linked to this contact
      const graphRes = await tar.tool('read', { table: 'graph', graph_filter: { tgt: entityId, rel: 'customer' }, scope });
      const dealIds = (graphRes?.rows || []).map((r: any) => r.src);
      if (dealIds.length > 0) {
        const dealsRes = await tar.tool('read', { table: 'matter', scope });
        const allDeals = (dealsRes?.rows || []).filter((m: any) => m.type === 'deal' && dealIds.includes(m.id));
        setLinkedDeals(allDeals);
      } else {
        // Fallback: check matter data customer/contact_id
        const dealsRes = await tar.tool('read', { table: 'matter', scope });
        const matched = (dealsRes?.rows || []).filter((m: any) => 
          m.type === 'deal' && (m.data?.contact_id === entityId || m.data?.customer === entity.title)
        );
        setLinkedDeals(matched);
      }
    } catch (e) {
      console.warn('[ContactDetails] Failed to fetch linked deals:', e);
      setLinkedDeals([]);
    } finally {
      setLoadingDeals(false);
    }
  };

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

  const parseTimestampMs = (raw: any): number => {
    if (!raw) return 0;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d.getTime();
      // Handle custom formatted strings like "Monday, 03 Aug, 12:21 am" or "03 Aug, 12:21 am"
      const match = raw.match(/(?:[A-Za-z]+,\s*)?(\d{1,2})\s+([A-Za-z]{3})(?:,\s*(\d{1,2}):(\d{2})\s*(am|pm|AM|PM))?/i);
      if (match) {
        const day = parseInt(match[1], 10);
        const monthStr = match[2];
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthIdx = months.indexOf(monthStr.toLowerCase());
        let hours = match[3] ? parseInt(match[3], 10) : 0;
        const minutes = match[4] ? parseInt(match[4], 10) : 0;
        const ampm = match[5] ? match[5].toLowerCase() : '';
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
        const now = new Date();
        const year = now.getFullYear();
        if (monthIdx >= 0) {
          return new Date(year, monthIdx, day, hours, minutes).getTime();
        }
      }
    }
    return 0;
  };

  const fetchLinkedMotions = async (entityId: string) => {
    if (!scope || !entityId) return;
    setLoadingMotions(true);
    try {
      const res = await tar.tool('read', { table: 'motion', ref: entityId, scope });
      const rows = res?.rows || [];
      rows.sort((a: any, b: any) => {
        const aData = typeof a.data === 'string' ? (JSON.parse(a.data || '{}') || {}) : (a.data || {});
        const bData = typeof b.data === 'string' ? (JSON.parse(b.data || '{}') || {}) : (b.data || {});
        const timeA = parseTimestampMs(a.timestamp || a.created_at || aData.date_str || a.id);
        const timeB = parseTimestampMs(b.timestamp || b.created_at || bData.date_str || b.id);
        return timeA - timeB;
      });
      setLinkedMotions(rows);
    } catch (e) {
      console.warn('[ContactDetails] Failed to fetch linked motions:', e);
      setLinkedMotions([]);
    } finally {
      setLoadingMotions(false);
    }
  };

  if (!visible || !entity) return null;

  const typeStr = (entity.type || entity.subRole || '').toLowerCase();
  const categoryName = entity.category || (
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
            {/* Contact Specific Hero Header */}
            {(() => {
              const roleDisplay = subRole || entity.role || entity.data?.role || 'Customer';
              const companyVal = company || entity.data?.company || entity.data?.org || '';

              return (
                <View style={{ gap: 10, marginBottom: 16 }}>
                  {/* Row 1: Contact Name (Tappable to Edit) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    {isEditing ? (
                      <TextInput
                        style={{ fontSize: 24, fontWeight: '700', color: theme.text, flex: 1, paddingVertical: 0 }}
                        value={name}
                        onChangeText={setName}
                        placeholder="Contact Name..."
                        placeholderTextColor={theme.textMuted + '80'}
                        autoFocus
                      />
                    ) : (
                      <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.7} style={{ flex: 1 }}>
                        <Text style={{ fontSize: 24, fontWeight: '700', color: theme.text }} numberOfLines={1}>
                          {name || 'Contact Details'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Row 2: Subrole / Organization info */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    {isEditing ? (
                      <TextInput
                        style={{ fontSize: 15, color: theme.text, flex: 1, paddingVertical: 2 }}
                        value={company}
                        onChangeText={setCompany}
                        placeholder="Company / Organization..."
                        placeholderTextColor={theme.textMuted + '80'}
                      />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '500', color: theme.textMuted, textTransform: 'lowercase' }}>
                          {roleDisplay}
                        </Text>
                        {Boolean(companyVal) && (
                          <>
                            <Text style={{ fontSize: 14, color: theme.textMuted }}>•</Text>
                            <Text style={{ fontSize: 15, fontWeight: '500', color: theme.textSecondary }}>
                              {companyVal}
                            </Text>
                          </>
                        )}
                      </View>
                    )}

                    {/* Quick Active Deals count badge */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="briefcase-outline" size={16} color={theme.primary} />
                      <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>
                        {linkedDeals.length} {linkedDeals.length === 1 ? 'Deal' : 'Deals'}
                      </Text>
                    </View>
                  </View>

                  {/* Save/Cancel Action Buttons when Editing */}
                  {isEditing && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
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
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Clearly Visible Solid Horizontal Section Divider */}
            <View
              style={{
                height: 1,
                backgroundColor: theme.border + '80',
                marginVertical: 12,
              }}
            />

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

                  {/* Deals Section (For Contact / Customer profiles) */}
            {['customer', 'staff', 'person', 'contact', 'company'].includes(typeStr) && (
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Deals ({linkedDeals.length})
                  </Text>
                </View>

                {loadingDeals ? (
                  <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 8 }} />
                ) : linkedDeals.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    {linkedDeals.map((deal) => {
                      const dVal = deal.value ? `$${deal.value.toLocaleString()}` : '$0';
                      const dStage = deal.data?.stage || 'New Inquiry';
                      return (
                        <TouchableOpacity
                          key={deal.id}
                          style={{
                            padding: 12,
                            borderRadius: 10,
                            backgroundColor: theme.border + '15',
                            borderWidth: 1,
                            borderColor: theme.border + '30',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }} numberOfLines={1}>
                              {deal.title || 'Sales Deal'}
                            </Text>
                            <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                              {dStage}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: theme.primary }}>
                            {dVal}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={{ fontSize: 13, color: theme.textMuted, fontStyle: 'italic', marginVertical: 4 }}>
                    No active deals for this contact.
                  </Text>
                )}
              </View>
            )}

            {/* Events Timeline Section — Seamless Feed */}
            <View style={styles.timelineSection}>

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
                          paddingVertical: 8,
                          borderBottomWidth: idx < linkedMotions.length - 1 ? StyleSheet.hairlineWidth : 0,
                          borderBottomColor: theme.border + '30',
                        }}
                      >
                        {/* Selected Icon with Soft Container Background */}
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            backgroundColor: iconColor ? iconColor + '15' : theme.primary + '12',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 2,
                          }}
                        >
                          {isEmoji ? (
                            <Text style={{ fontSize: 17 }}>{iconName}</Text>
                          ) : iconName ? (
                            <Ionicons name={iconName as any} size={18} color={iconColor || theme.primary} />
                          ) : m.type === 'stage' ? (
                            <Ionicons name="pricetag-outline" size={17} color={theme.primary} />
                          ) : (
                            <Ionicons name="calendar-outline" size={17} color={theme.text} />
                          )}
                        </View>

                        {/* Event Details */}
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, flex: 1, marginRight: 8 }} numberOfLines={1}>
                              {title}
                            </Text>
                            {Boolean(dateStr) && (
                              <Text style={{ fontSize: 12, fontWeight: '500', color: theme.textMuted }}>
                                {compactTimestamp(dateStr)}
                              </Text>
                            )}
                          </View>
                          {Boolean(notesStr) && (
                            <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 1 }}>
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

          {/* Floating Action Button (FAB) for Adding Deals */}
          <TouchableOpacity
            onPress={() => {
              if (onLogEventForEntity) {
                onLogEventForEntity(entity, 'stage');
              }
            }}
            activeOpacity={0.85}
            style={{
              position: 'absolute',
              right: 20,
              bottom: Math.max(insets.bottom + 16, 24),
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: theme.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={28} color="#ffffff" />
          </TouchableOpacity>
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

        {/* Full-Screen / Sheet New Event Modal */}
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

            {/* Event Selection Screen (Full Screen Modal) */}
            {showIconPickerDrawer && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: theme.background,
                  paddingHorizontal: 20,
                  paddingTop: Math.max(insets.top + 8, 12),
                  paddingBottom: Math.max(insets.bottom + 12, 16),
                  zIndex: 9999,
                }}
              >
                {/* Header: Native Back Arrow | Select Event Title */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border + '30', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setShowIconPickerDrawer(false)} hitSlop={12} style={{ padding: 4 }}>
                    <Ionicons name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} size={24} color={theme.text} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>
                    Select Event
                  </Text>
                </View>

                {/* Event Types Content (Compact, Clean Spacing) */}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 16, paddingBottom: 16 }}>
                  {/* Category 1: Interaction types */}
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Interaction types
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                      {INTERACTION_TYPES_ICONS.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => {
                            setSelectedInteractionIcon({ name: item.name, isEmoji: false });
                            setShowIconPickerDrawer(false);
                          }}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: theme.border + '15',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name={item.name as any} size={22} color={theme.text} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Category 2: Messaging apps */}
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Messaging apps
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                      {MESSAGING_APPS_ICONS.map((app) => (
                        <TouchableOpacity
                          key={app.id}
                          onPress={() => {
                            setSelectedInteractionIcon({ name: app.name, isEmoji: false, color: app.color });
                            setShowIconPickerDrawer(false);
                          }}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: theme.border + '15',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name={app.name as any} size={22} color={app.color} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Category 3: Deal stage pipeline */}
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Deal stage pipeline
                    </Text>
                    <View style={{ gap: 8 }}>
                      {DEAL_STAGE_ICONS.map((stg) => (
                        <TouchableOpacity
                          key={stg.id}
                          onPress={() => {
                            setSelectedInteractionIcon({ name: stg.icon, isEmoji: stg.isEmoji, color: stg.color, stageName: stg.stageName });
                            if (!interactionTitle || interactionTitle.startsWith('Event with')) {
                              setInteractionTitle(stg.stageName);
                            }
                            setShowIconPickerDrawer(false);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                            borderRadius: 12,
                            backgroundColor: theme.border + '15',
                            borderWidth: 1,
                            borderColor: theme.border + '20',
                          }}
                        >
                          {stg.isEmoji ? (
                            <Text style={{ fontSize: 18 }}>{stg.icon}</Text>
                          ) : (
                            <Ionicons name={stg.icon as any} size={20} color={stg.color || theme.text} />
                          )}
                          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>
                            {stg.stageName}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </ScrollView>
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
