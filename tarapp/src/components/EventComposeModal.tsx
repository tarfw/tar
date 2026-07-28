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
  Platform,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const PLAN5_EVENT_MOTIONS = [
  { event: 'Sale', actionName: 'action_record_sale', whatHappened: 'Transaction completed', linksTo: 'Order', params: [{ name: 'items', type: 'text', required: true }, { name: 'payment_method', type: 'text', required: true }, { name: 'total', type: 'number', required: true }, { name: 'customer_id', type: 'text', required: false }] },
  { event: 'Refund', actionName: 'action_refund_order', whatHappened: 'Money returned', linksTo: 'Order', params: [{ name: 'order_id', type: 'text', required: true }, { name: 'amount', type: 'number', required: true }, { name: 'reason', type: 'text', required: false }] },
  { event: 'Status Change', actionName: 'action_update_status', whatHappened: 'State updated', linksTo: 'Any entity', params: [{ name: 'entity_id', type: 'text', required: true }, { name: 'status', type: 'text', required: true }] },
  { event: 'Booking', actionName: 'action_book_slot', whatHappened: 'Appointment made', linksTo: 'Booking', params: [{ name: 'service', type: 'text', required: true }, { name: 'date', type: 'text', required: true }, { name: 'slot', type: 'text', required: true }, { name: 'customer_id', type: 'text', required: false }] },
  { event: 'Cancel', actionName: 'action_cancel_booking', whatHappened: 'Booking cancelled', linksTo: 'Booking', params: [{ name: 'booking_id', type: 'text', required: true }, { name: 'reason', type: 'text', required: false }] },
  { event: 'Clock In', actionName: 'action_clock_in', whatHappened: 'Staff arrived', linksTo: 'Person', params: [{ name: 'staff_id', type: 'text', required: true }] },
  { event: 'Clock Out', actionName: 'action_clock_out', whatHappened: 'Staff left', linksTo: 'Person', params: [{ name: 'staff_id', type: 'text', required: true }] },
  { event: 'Tracking', actionName: 'action_update_tracking', whatHappened: 'Shipment updated', linksTo: 'Shipment', params: [{ name: 'shipment_id', type: 'text', required: true }, { name: 'status', type: 'text', required: true }, { name: 'location', type: 'text', required: false }] },
  { event: 'Delivered', actionName: 'action_complete_delivery', whatHappened: 'Shipment fulfilled', linksTo: 'Shipment', params: [{ name: 'shipment_id', type: 'text', required: true }, { name: 'recipient_signature', type: 'text', required: false }] },
  { event: 'Stage', actionName: 'action_update_deal_stage', whatHappened: 'Deal advanced', linksTo: 'Deal', params: [{ name: 'deal_id', type: 'text', required: true }, { name: 'stage', type: 'text', required: true }, { name: 'win_loss_reason', type: 'text', required: false }] },
  { event: 'Activity', actionName: 'action_log_activity', whatHappened: 'Call/meeting logged', linksTo: 'Deal, Person', params: [{ name: 'type', type: 'text', required: true }, { name: 'description', type: 'text', required: true }, { name: 'contact_id', type: 'text', required: false }, { name: 'deal_id', type: 'text', required: false }] },
  { event: 'Adjust', actionName: 'action_adjust_stock', whatHappened: 'Stock changed', linksTo: 'Product', params: [{ name: 'product_id', type: 'text', required: true }, { name: 'qty', type: 'number', required: true }, { name: 'reason', type: 'text', required: false }] },
  { event: 'Write Off', actionName: 'action_write_off', whatHappened: 'Stock removed', linksTo: 'Product', params: [{ name: 'product_id', type: 'text', required: true }, { name: 'qty', type: 'number', required: true }, { name: 'reason', type: 'text', required: false }] },
  { event: 'Expense', actionName: 'action_record_expense', whatHappened: 'Cost recorded', linksTo: 'Expense', params: [{ name: 'category', type: 'text', required: true }, { name: 'amount', type: 'number', required: true }, { name: 'description', type: 'text', required: false }, { name: 'date', type: 'text', required: false }] },
  { event: 'Assignment', actionName: 'action_create_task', whatHappened: 'Task assigned', linksTo: 'Project', params: [{ name: 'title', type: 'text', required: true }, { name: 'description', type: 'text', required: false }, { name: 'assignee_id', type: 'text', required: false }, { name: 'due_date', type: 'text', required: false }] },
  { event: 'Add Item', actionName: 'action_add_product', whatHappened: 'Item cataloged', linksTo: 'Item', params: [{ name: 'title', type: 'text', required: true }, { name: 'item_subtype', type: 'text', required: true }, { name: 'price', type: 'number', required: false }, { name: 'stock', type: 'number', required: false }, { name: 'category', type: 'text', required: false }] },
];

export interface EventComposeModalProps {
  visible: boolean;
  action: any | null;
  formParams: Record<string, string>;
  theme: any;
  submitting: boolean;
  resultMessage: string | null;
  allEntities?: any[];
  onClose: () => void;
  onSubmit: (params: Record<string, string>) => void;
  onSelectEvent?: (eventAction: any) => void;
}

interface OptionPickerConfig {
  title: string;
  paramName: string;
  options: Array<{ label: string; value: string; subtitle?: string; email?: string; rawEntity?: any }>;
  targetLineId?: string;
}

export interface LineItem {
  id: string;
  name: string;
  qty: number;
  price: number;
}

const AVATAR_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1'];

function getAvatarColor(name: string = '') {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(name: string = '') {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function EventComposeModal({
  visible,
  action,
  formParams,
  theme,
  submitting,
  resultMessage,
  allEntities = [],
  onClose,
  onSubmit,
  onSelectEvent,
}: EventComposeModalProps) {
  const insets = useSafeAreaInsets();
  const [params, setParams] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [activePicker, setActivePicker] = useState<OptionPickerConfig | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // Line items state (starts with 1 empty row, always maintains 1 trailing empty row)
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: 'item_1', name: '', qty: 1, price: 0 },
  ]);

  useEffect(() => {
    if (formParams) {
      setParams({ ...formParams });
    }
  }, [formParams]);

  // Ensure an extra empty line item always exists at the bottom
  useEffect(() => {
    if (action?.name === 'action_record_sale') {
      const last = lineItems[lineItems.length - 1];
      if (last && (last.name.trim() !== '' || last.price > 0)) {
        setLineItems((prev) => [
          ...prev,
          { id: `item_${Date.now()}`, name: '', qty: 1, price: 0 },
        ]);
      }
    }
  }, [lineItems, action?.name]);

  // Recalculate Total & Summary Items when lineItems change
  useEffect(() => {
    if (action?.name === 'action_record_sale') {
      const validItems = lineItems.filter((i) => i.name.trim() !== '');
      const calculatedTotal = validItems.reduce((sum, item) => sum + (item.qty || 1) * (item.price || 0), 0);
      const summaryItems = validItems
        .map((i) => `${i.name.trim()}${i.qty > 1 ? ` x${i.qty}` : ''}`)
        .join(', ');

      setParams((prev) => ({
        ...prev,
        total: calculatedTotal > 0 ? calculatedTotal.toString() : '',
        items: summaryItems || prev.items || '',
      }));
    }
  }, [lineItems, action?.name]);

  if (!visible || !action) return null;

  const actionName = action?.name?.replace(/_/g, ' ') || 'Record Event';
  const paramList: any[] = action?.params || [];

  // Categorize & Order Params: 1. To, 2. Items/Products, 3. Total/Value, 4. Intermediate, 99. Payment Method (last)
  const getParamRank = (name: string) => {
    const n = name.toLowerCase();
    if (n === 'customer_id' || n === 'contact_id' || n === 'staff_id' || n === 'assignee_id' || n === 'person_id' || n === 'to') return 1;
    if (n === 'items' || n === 'product_id' || n === 'service' || n === 'order_id' || n === 'booking_id') return 2;
    if (n === 'total' || n === 'amount' || n === 'qty' || n === 'price') return 3;
    if (n === 'payment_method') return 99; // Payment method always last before notes
    return 10;
  };

  const sortedParamList = [...paramList].sort((a, b) => {
    const nameA = typeof a === 'string' ? a : a.name;
    const nameB = typeof b === 'string' ? b : b.name;
    return getParamRank(nameA) - getParamRank(nameB);
  });

  const getFieldInfo = (p: any) => {
    const rawName = typeof p === 'string' ? p : p.name;
    const name = rawName.toLowerCase();
    const isRequired = typeof p === 'object' && p.required;

    if (
      name === 'customer_id' ||
      name === 'contact_id' ||
      name === 'staff_id' ||
      name === 'assignee_id' ||
      name === 'person_id'
    ) {
      return { key: rawName, label: 'To', isTarget: true, isSelectable: true, isRequired };
    }

    if (name === 'entity_id' || name === 'order_id' || name === 'booking_id' || name === 'shipment_id' || name === 'deal_id' || name === 'product_id') {
      return { key: rawName, label: rawName.replace(/_id$/i, '').replace(/_/g, ' '), isTarget: false, isSelectable: true, isRequired };
    }

    if (name === 'payment_method' || name === 'status' || name === 'stage' || name === 'date' || name === 'slot' || name === 'category' || name === 'type') {
      return { key: rawName, label: rawName.replace(/_/g, ' '), isTarget: false, isSelectable: true, isRequired };
    }

    return { key: rawName, label: rawName.replace(/_/g, ' '), isTarget: false, isSelectable: false, isRequired };
  };

  const fieldInfos = sortedParamList.map(getFieldInfo);

  // Check required parameters validation
  const missingRequired = fieldInfos.filter((info) => info.isRequired && !params[info.key]?.trim());
  const isFormValid = missingRequired.length === 0;

  const handleTextChange = (paramName: string, val: string) => {
    setParams((prev) => ({ ...prev, [paramName]: val }));
  };

  const handleSend = () => {
    if (!isFormValid || submitting) return;
    const finalParams = { ...params };
    if (notes.trim()) {
      finalParams.notes = notes.trim();
      finalParams.description = notes.trim();
    }
    onSubmit(finalParams);
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  };

  const openPickerForField = (info: ReturnType<typeof getFieldInfo>, targetLineId?: string) => {
    const key = info.key.toLowerCase();
    setPickerSearch('');

    // 1. Target Person / Customer / Contact picker (Person / Company entities only)
    if (info.isTarget || key === 'customer_id' || key === 'contact_id' || key === 'staff_id' || key === 'assignee_id' || key === 'person_id') {
      const personTypes = ['customer', 'person', 'contact', 'staff', 'manager', 'admin', 'company', 'vendor', 'partner'];
      const filtered = (allEntities || []).filter((e: any) => {
        const t = (e?.type || '').toLowerCase();
        const r = (e?.role || '').toLowerCase();
        return personTypes.includes(t) || personTypes.includes(r);
      });

      const options = filtered.map((e: any) => ({
        label: e.title || e.name || 'Contact',
        value: e.title || e.name || e.id,
        subtitle: `${e.type || 'Person'} • ${e.role || 'Member'}`,
        email: e.data?.email || e.email || `${(e.title || 'user').toLowerCase().replace(/\s+/g, '')}@workspace.com`,
        rawEntity: e,
      }));

      setActivePicker({
        title: `Select ${info.label}`,
        paramName: info.key,
        options: options.length > 0 ? options : [
          { label: 'Anjali Sharma', value: 'Anjali Sharma', subtitle: 'Customer', email: 'anjali@example.com' },
          { label: 'Rahul Verma', value: 'Rahul Verma', subtitle: 'Staff Member', email: 'rahul@workspace.com' },
          { label: 'Acme Traders', value: 'Acme Traders', subtitle: 'Vendor', email: 'orders@acme.com' },
        ],
      });
      return;
    }

    // 2. Product / Item picker (Used for single Product fields and multi-line item rows)
    if (key === 'product_id' || key === 'item_id' || targetLineId) {
      const productTypes = ['product', 'item', 'listing', 'asset', 'inventory'];
      const filtered = (allEntities || []).filter((e: any) => {
        const t = (e?.type || '').toLowerCase();
        const r = (e?.role || '').toLowerCase();
        return productTypes.includes(t) || productTypes.includes(r);
      });

      const options = filtered.map((e: any) => ({
        label: e.title || e.name || 'Product',
        value: e.title || e.name || e.id,
        subtitle: `Product • Price: $${e.value || e.data?.price || 0}`,
        rawEntity: e,
      }));

      setActivePicker({
        title: 'Select Product',
        paramName: targetLineId ? '__line_product__' : info.key,
        targetLineId,
        options: options.length > 0 ? options : [
          { label: 'Cappuccino', value: 'Cappuccino', subtitle: 'Price: $5', rawEntity: { value: 5 } },
          { label: 'Croissant', value: 'Croissant', subtitle: 'Price: $4', rawEntity: { value: 4 } },
          { label: 'Espresso', value: 'Espresso', subtitle: 'Price: $3', rawEntity: { value: 3 } },
        ],
      });
      return;
    }

    // 3. Preset options (Payment, Status, Date, Slot, Category)
    let presets: Array<{ label: string; value: string; subtitle?: string }> = [];
    if (key.includes('payment')) {
      presets = [
        { label: 'Cash', value: 'Cash', subtitle: 'Instant Cash Payment' },
        { label: 'Card', value: 'Card', subtitle: 'Credit/Debit Card' },
        { label: 'UPI', value: 'UPI', subtitle: 'Digital Transfer' },
        { label: 'Invoice', value: 'Invoice', subtitle: 'Pay Later / Credit' },
      ];
    } else if (key === 'status' || key === 'stage') {
      presets = [
        { label: 'Pending', value: 'Pending', subtitle: 'Awaiting action' },
        { label: 'Confirmed', value: 'Confirmed', subtitle: 'Order/slot confirmed' },
        { label: 'In Transit', value: 'In Transit', subtitle: 'Dispatched / On the way' },
        { label: 'Delivered', value: 'Delivered', subtitle: 'Fulfilled' },
        { label: 'Cancelled', value: 'Cancelled', subtitle: 'Voided' },
      ];
    } else if (key.includes('date')) {
      presets = [
        { label: 'Today', value: new Date().toISOString().slice(0, 10), subtitle: 'Current Date' },
        { label: 'Tomorrow', value: new Date(Date.now() + 86400000).toISOString().slice(0, 10), subtitle: 'Next Day' },
        { label: 'Next Week', value: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), subtitle: 'In 7 Days' },
      ];
    } else if (key.includes('slot')) {
      presets = [
        { label: '9:00 AM', value: '9:00 AM', subtitle: 'Morning Slot' },
        { label: '12:00 PM', value: '12:00 PM', subtitle: 'Noon Slot' },
        { label: '4:00 PM', value: '4:00 PM', subtitle: 'Afternoon Slot' },
        { label: '6:00 PM', value: '6:00 PM', subtitle: 'Evening Slot' },
      ];
    } else if (key.includes('category') || key === 'type') {
      presets = [
        { label: 'Travel', value: 'Travel', subtitle: 'Transport / Mileage' },
        { label: 'Salary', value: 'Salary', subtitle: 'Payroll & Compensation' },
        { label: 'Vendor', value: 'Vendor', subtitle: 'Supplier Expense' },
        { label: 'Utility', value: 'Utility', subtitle: 'Bills & Operating Costs' },
      ];
    } else if (key.includes('subtype') || key.includes('item_subtype')) {
      presets = [
        { label: 'Product', value: 'Product', subtitle: 'Physical Goods & Merchandise' },
        { label: 'Listing', value: 'Listing', subtitle: 'Catalog, Real Estate, Subscription' },
        { label: 'Service', value: 'Service', subtitle: 'Time-based Offerings & Appointments' },
        { label: 'Document', value: 'Document', subtitle: 'Files, Contracts, Receipts' },
        { label: 'Asset', value: 'Asset', subtitle: 'Equipment, Tools, Machinery' },
      ];
    }

    if (presets.length > 0) {
      setActivePicker({
        title: `Select ${info.label}`,
        paramName: info.key,
        options: presets,
      });
    }
  };

  const openEventPicker = () => {
    setPickerSearch('');
    setActivePicker({
      title: 'Select Motion Event',
      paramName: '__event__',
      options: PLAN5_EVENT_MOTIONS.map((item) => ({
        label: item.event,
        value: item.actionName,
        subtitle: `${item.whatHappened} • ${item.linksTo}`,
      })),
    });
  };

  // Render Gmail Style Target Profile Pill
  const renderGmailTargetValue = (targetValue: string) => {
    if (!targetValue) {
      return (
        <Text style={[styles.fieldTextValue, { color: theme.textMuted + '80' }]}>
          Select customer or recipient...
        </Text>
      );
    }

    const matchedEntity = (allEntities || []).find((e) => e?.title === targetValue || e?.name === targetValue || e?.id === targetValue);
    const displayName = matchedEntity?.title || matchedEntity?.name || targetValue;
    const email = matchedEntity?.data?.email || matchedEntity?.email || `${displayName.toLowerCase().replace(/\s+/g, '')}@workspace.com`;

    return (
      <View style={styles.gmailProfilePill}>
        <View style={[styles.avatarCircle, { backgroundColor: getAvatarColor(displayName) }]}>
          <Text style={styles.avatarInitials}>{getInitials(displayName)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.profileSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
            {email}
          </Text>
        </View>
      </View>
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
          {/* Ultra-Minimalist Top Bar */}
          <View style={[styles.headerBar, { borderBottomColor: theme.border }]}>
            {/* Interactive Left-Aligned Event Selector Pill */}
            <Pressable
              onPress={openEventPicker}
              style={({ pressed }) => [
                styles.headerEventPill,
                { backgroundColor: theme.primary + '15', opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.headerEventText, { color: theme.primary }]}>
                {actionName}
              </Text>
              <Ionicons name="chevron-down" size={14} color={theme.primary} />
            </Pressable>

            {/* Right Send Action Button */}
            <TouchableOpacity
              onPress={handleSend}
              disabled={submitting || !isFormValid}
              hitSlop={8}
              style={[styles.sendTextBtn, { opacity: isFormValid && !submitting ? 1 : 0.4 }]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[styles.sendText, { color: theme.primary }]}>Send</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Toast Banner */}
          {resultMessage && (
            <View
              style={[
                styles.resultToast,
                { backgroundColor: resultMessage.includes('Error') || resultMessage.includes('Failed') ? '#fef2f2' : '#f0fdf4' },
              ]}
            >
              <Ionicons
                name={resultMessage.includes('Error') || resultMessage.includes('Failed') ? 'alert-circle' : 'checkmark-circle'}
                size={18}
                color={resultMessage.includes('Error') || resultMessage.includes('Failed') ? '#dc2626' : '#16a34a'}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: resultMessage.includes('Error') || resultMessage.includes('Failed') ? '#dc2626' : '#16a34a',
                  flex: 1,
                }}
              >
                {resultMessage}
              </Text>
            </View>
          )}

          {/* Form Scroll Area */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollBody, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}
            keyboardShouldPersistTaps="handled"
          >

            {/* Dynamic Ordered Form Parameter Rows */}
            {fieldInfos.map((info) => {
              const value = params[info.key] || '';
              const isNumeric = info.key.includes('total') || info.key.includes('amount') || info.key.includes('qty') || info.key.includes('price');
              const hintLabel = info.isTarget
                ? 'To'
                : info.label === 'payment_method'
                ? 'Payment method'
                : info.label === 'total' || info.label === 'amount'
                ? 'Total'
                : info.label;

              // A. Gmail Style Target "To" Row (Ultra Minimal Hint)
              if (info.isTarget) {
                return (
                  <Pressable
                    key={info.key}
                    onPress={() => openPickerForField(info)}
                    style={({ pressed }) => [
                      styles.fieldRowLarge,
                      { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    {value ? (
                      renderGmailTargetValue(value)
                    ) : (
                      <Text style={[styles.fieldTextValue, { color: theme.textMuted + '80' }]}>
                        {hintLabel} {info.isRequired ? <Text style={{ color: '#ef4444' }}>*</Text> : null}
                      </Text>
                    )}
                    <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
                  </Pressable>
                );
              }

              // B. Multi-Line Items Builder (Ultra Minimal Hint Rows)
              if (action?.name === 'action_record_sale' && info.key === 'items') {
                return (
                  <View key={info.key}>
                    {lineItems.map((item, idx) => (
                      <Pressable
                        key={item.id}
                        onPress={() => openPickerForField({ key: 'items', label: 'Item', isTarget: false, isSelectable: true, isRequired: false }, item.id)}
                        style={({ pressed }) => [
                          styles.fieldRow,
                          { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        {item.name ? (
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 4 }}>
                            <Text style={[styles.fieldTextValue, { color: theme.text, fontWeight: '500' }]} numberOfLines={1}>
                              {item.name} {item.qty > 1 ? `(x${item.qty})` : ''}
                            </Text>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginLeft: 8 }}>
                              ${(item.qty * (item.price || 0)).toFixed(2)}
                            </Text>
                          </View>
                        ) : (
                          <Text style={[styles.fieldTextValue, { color: theme.textMuted + '80' }]}>
                            {idx === 0 ? 'Items' : `Item ${idx + 1}`} {idx === 0 && info.isRequired ? <Text style={{ color: '#ef4444' }}>*</Text> : null}
                          </Text>
                        )}

                        {lineItems.length > 1 && item.name.trim() !== '' ? (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              removeLineItem(item.id);
                            }}
                            hitSlop={8}
                            style={{ paddingLeft: 4 }}
                          >
                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                          </TouchableOpacity>
                        ) : (
                          <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                );
              }

              // C. Other Selectable Fields (Ultra Minimal Hint Rows)
              if (info.isSelectable) {
                return (
                  <Pressable
                    key={info.key}
                    onPress={() => openPickerForField(info)}
                    style={({ pressed }) => [
                      styles.fieldRow,
                      { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={[styles.fieldTextValue, { color: value ? theme.text : theme.textMuted + '80', fontWeight: value ? '500' : '400' }]}>
                      {value ? `${info.label}: ${value}` : `${hintLabel} ${info.isRequired ? '*' : ''}`}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
                  </Pressable>
                );
              }

              // D. Standard Text / Numeric Input Fields (Ultra Minimal Placeholder Hint)
              return (
                <View key={info.key} style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                  <TextInput
                    style={[styles.fieldInput, { color: theme.text, fontWeight: isNumeric ? '600' : '400' }]}
                    value={value}
                    keyboardType={isNumeric ? 'numeric' : 'default'}
                    onChangeText={(val) => handleTextChange(info.key, val)}
                    placeholder={`${hintLabel} ${info.isRequired ? '*' : ''}`}
                    placeholderTextColor={theme.textMuted + '80'}
                  />
                </View>
              );
            })}

            {/* Compose Body / Notes */}
            <View style={styles.bodyContainer}>
              <TextInput
                style={[styles.bodyInput, { color: theme.text }]}
                multiline
                value={notes}
                onChangeText={setNotes}
                placeholder="Compose event details, notes, or motion description..."
                placeholderTextColor={theme.textMuted + '80'}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* Unified Bulletproof Option Picker Modal */}
      <Modal
        visible={activePicker !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActivePicker(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setActivePicker(null)}>
          <Pressable style={[styles.pickerContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: theme.text }]}>{activePicker?.title}</Text>
              <Pressable onPress={() => setActivePicker(null)}>
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </Pressable>
            </View>

            {/* Search Input inside Picker */}
            {activePicker?.options && activePicker.options.length > 4 ? (
              <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <Ionicons name="search" size={16} color={theme.textMuted} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Search options..."
                  placeholderTextColor={theme.textMuted + '80'}
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                />
              </View>
            ) : null}

            <ScrollView style={{ maxHeight: 350 }}>
              {(activePicker?.options || [])
                .filter((opt) => {
                  if (!opt) return false;
                  const labelStr = String(opt.label || '').toLowerCase();
                  const subStr = String(opt.subtitle || '').toLowerCase();
                  const q = pickerSearch.toLowerCase().trim();
                  return !q || labelStr.includes(q) || subStr.includes(q);
                })
                .map((opt, idx) => {
                  const optVal = opt.value ?? `opt_${idx}`;
                  const isSelected = activePicker.paramName === '__event__'
                    ? action?.name === optVal
                    : params[activePicker.paramName] === optVal;

                  const isPersonPicker = activePicker.title.includes('To') || activePicker.title.includes('Contact') || activePicker.title.includes('Staff');

                  return (
                    <Pressable
                      key={`${optVal}_${idx}`}
                      onPress={() => {
                        if (activePicker.paramName === '__event__') {
                          const eventObj = PLAN5_EVENT_MOTIONS.find((e) => e.actionName === optVal);
                          if (eventObj) {
                            onSelectEvent?.({
                              name: eventObj.actionName,
                              purpose: eventObj.whatHappened,
                              params: eventObj.params,
                            });
                          }
                        } else if (activePicker.paramName === '__line_product__' && activePicker.targetLineId) {
                          const prdName = opt.label || optVal;
                          const prdPrice = opt.rawEntity?.value || opt.rawEntity?.data?.price || 0;
                          updateLineItem(activePicker.targetLineId, 'name', prdName);
                          if (prdPrice > 0) {
                            updateLineItem(activePicker.targetLineId, 'price', prdPrice);
                          }
                        } else {
                          handleTextChange(activePicker.paramName, optVal);
                        }
                        setActivePicker(null);
                      }}
                      style={({ pressed }) => [
                        styles.pickerItem,
                        {
                          borderBottomColor: theme.border + '40',
                          backgroundColor: pressed ? theme.border + '30' : isSelected ? theme.primary + '15' : 'transparent',
                        },
                      ]}
                    >
                      {/* Gmail Style Avatar inside Picker */}
                      {isPersonPicker ? (
                        <View style={[styles.avatarCircle, { backgroundColor: getAvatarColor(opt.label), marginRight: 10 }]}>
                          <Text style={styles.avatarInitials}>{getInitials(opt.label)}</Text>
                        </View>
                      ) : null}

                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: isSelected ? '700' : '500', color: isSelected ? theme.primary : theme.text }}>
                          {opt.label || 'Option'}
                        </Text>
                        {opt.subtitle || opt.email ? (
                          <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                            {opt.email ? `${opt.email} • ${opt.subtitle}` : opt.subtitle}
                          </Text>
                        ) : null}
                      </View>
                      {isSelected && <Ionicons name="checkmark" size={18} color={theme.primary} />}
                    </Pressable>
                  );
                })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  headerEventPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerEventText: {
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  sendTextBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sendText: {
    fontSize: 17,
    fontWeight: '600',
  },
  resultToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  fieldRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  fieldRowLarge: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  fieldLabel: {
    width: 90,
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
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
  gmailProfilePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  profileSubtitle: {
    fontSize: 11,
  },
  multiItemSection: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    gap: 8,
  },
  productSelectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  productSelectText: {
    fontSize: 13,
    flex: 1,
    marginRight: 4,
  },
  qtyBox: {
    width: 45,
    alignItems: 'center',
  },
  qtyInput: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 2,
  },
  priceBox: {
    width: 65,
    alignItems: 'center',
  },
  priceInput: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 2,
  },
  bodyContainer: {
    paddingTop: 16,
    minHeight: 200,
  },
  bodyInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 180,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
