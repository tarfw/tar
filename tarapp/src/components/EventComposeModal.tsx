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
  options: Array<{ label: string; value: string; subtitle?: string }>;
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

  useEffect(() => {
    if (formParams) {
      setParams({ ...formParams });
    }
  }, [formParams]);

  if (!visible || !action) return null;

  const actionName = action?.name?.replace(/_/g, ' ') || 'Record Event';
  const paramList: any[] = action?.params || [];

  // Helper to identify parameter field types & labels cleanly
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

  const fieldInfos = paramList.map(getFieldInfo);

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

  const openPickerForField = (info: ReturnType<typeof getFieldInfo>) => {
    const key = info.key.toLowerCase();

    // 1. Target Person / Customer / Contact picker (Person / Company entities only)
    if (info.isTarget || key === 'customer_id' || key === 'contact_id' || key === 'staff_id' || key === 'assignee_id' || key === 'person_id') {
      const personTypes = ['customer', 'person', 'contact', 'staff', 'manager', 'admin', 'company', 'vendor', 'partner'];
      const filtered = allEntities.filter((e: any) => {
        const t = (e.type || '').toLowerCase();
        const r = (e.role || '').toLowerCase();
        return personTypes.includes(t) || personTypes.includes(r);
      });

      const options = filtered.map((e: any) => ({
        label: e.title || e.name || e.id,
        value: e.id || e.name || e.title,
        subtitle: `${e.type || 'Person'} • ${e.role || 'Member'}`,
      }));

      setActivePicker({
        title: `Select ${info.label}`,
        paramName: info.key,
        options: options.length > 0 ? options : [
          { label: 'Customer (Guest)', value: 'customer_guest', subtitle: 'Walk-in Buyer' },
          { label: 'Staff Member', value: 'staff_member', subtitle: 'Internal Team' },
          { label: 'Vendor Contact', value: 'vendor_contact', subtitle: 'External Partner' },
        ],
      });
      return;
    }

    // 2. Product / Item picker (Item / Product entities only)
    if (key === 'product_id' || key === 'item_id') {
      const productTypes = ['product', 'item', 'listing', 'asset', 'inventory'];
      const filtered = allEntities.filter((e: any) => {
        const t = (e.type || '').toLowerCase();
        const r = (e.role || '').toLowerCase();
        return productTypes.includes(t) || productTypes.includes(r);
      });

      const options = filtered.map((e: any) => ({
        label: e.title || e.name || e.id,
        value: e.id || e.name || e.title,
        subtitle: `Product • ${e.stock !== undefined ? 'Stock: ' + e.stock : 'Available'}`,
      }));

      setActivePicker({
        title: 'Select Product',
        paramName: info.key,
        options: options.length > 0 ? options : [
          { label: 'Standard Product', value: 'product_standard', subtitle: 'Catalog Item' },
        ],
      });
      return;
    }

    // 3. Order picker (Order / Sale entities only)
    if (key === 'order_id') {
      const filtered = allEntities.filter((e: any) => {
        const t = (e.type || '').toLowerCase();
        return t === 'order' || t === 'sale';
      });

      const options = filtered.map((e: any) => ({
        label: e.title || `Order #${e.id?.slice(-4)}`,
        value: e.id || e.title,
        subtitle: `Order • ${e.status || 'Active'}`,
      }));

      setActivePicker({
        title: 'Select Order',
        paramName: info.key,
        options: options.length > 0 ? options : [
          { label: 'Order #1042', value: 'ord_1042', subtitle: 'Active Order' },
        ],
      });
      return;
    }

    // 4. Booking picker (Booking entities only)
    if (key === 'booking_id') {
      const filtered = allEntities.filter((e: any) => {
        const t = (e.type || '').toLowerCase();
        return t === 'booking';
      });

      const options = filtered.map((e: any) => ({
        label: e.title || `Booking #${e.id?.slice(-4)}`,
        value: e.id || e.title,
        subtitle: `Booking • ${e.status || 'Confirmed'}`,
      }));

      setActivePicker({
        title: 'Select Booking',
        paramName: info.key,
        options: options.length > 0 ? options : [
          { label: 'Booking #201', value: 'book_201', subtitle: 'Active Appointment' },
        ],
      });
      return;
    }

    // 5. Shipment picker (Shipment / Delivery entities only)
    if (key === 'shipment_id') {
      const filtered = allEntities.filter((e: any) => {
        const t = (e.type || '').toLowerCase();
        return t === 'shipment' || t === 'delivery';
      });

      const options = filtered.map((e: any) => ({
        label: e.title || `Shipment #${e.id?.slice(-4)}`,
        value: e.id || e.title,
        subtitle: `Shipment • ${e.status || 'In Transit'}`,
      }));

      setActivePicker({
        title: 'Select Shipment',
        paramName: info.key,
        options: options.length > 0 ? options : [
          { label: 'Shipment #401', value: 'ship_401', subtitle: 'In Transit' },
        ],
      });
      return;
    }

    // 6. Deal picker (Deal / Pipeline entities only)
    if (key === 'deal_id') {
      const filtered = allEntities.filter((e: any) => {
        const t = (e.type || '').toLowerCase();
        return t === 'deal' || t === 'pipeline';
      });

      const options = filtered.map((e: any) => ({
        label: e.title || `Deal #${e.id?.slice(-4)}`,
        value: e.id || e.title,
        subtitle: `Deal • ${e.stage || 'Negotiation'}`,
      }));

      setActivePicker({
        title: 'Select Deal',
        paramName: info.key,
        options: options.length > 0 ? options : [
          { label: 'Enterprise Deal #101', value: 'deal_101', subtitle: 'Pipeline Deal' },
        ],
      });
      return;
    }

    // 7. Generic Entity ID (Status Change)
    if (key === 'entity_id') {
      const options = allEntities.map((e: any) => ({
        label: e.title || e.name || e.id,
        value: e.id || e.name || e.title,
        subtitle: `${e.type || 'Entity'} • ${e.status || 'Active'}`,
      }));

      setActivePicker({
        title: 'Select Entity',
        paramName: info.key,
        options: options.length > 0 ? options : [
          { label: 'Workspace Entity', value: 'ent_01', subtitle: 'Active Entity' },
        ],
      });
      return;
    }

    // 8. Selectable preset options
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
          {/* Top Bar */}
          <View style={[styles.headerBar, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: theme.text }]}>Compose Event</Text>

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
            {/* Event Selector Row */}
            <Pressable
              onPress={openEventPicker}
              style={({ pressed }) => [
                styles.fieldRow,
                { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Event</Text>
              <Text style={[styles.fieldTextValue, { color: theme.primary, fontWeight: '600' }]}>
                {actionName}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
            </Pressable>

            {/* Dynamic Form Parameter Rows */}
            {fieldInfos.map((info) => {
              const value = params[info.key] || '';
              const isNumeric = info.key.includes('total') || info.key.includes('amount') || info.key.includes('qty') || info.key.includes('price');

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
                    <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
                      {info.label} {info.isRequired ? <Text style={{ color: '#ef4444' }}>*</Text> : null}
                    </Text>
                    <Text style={[styles.fieldTextValue, { color: value ? theme.text : theme.textMuted + '80', textTransform: info.isTarget ? 'capitalize' : 'none' }]}>
                      {value || `Select ${info.label.toLowerCase()}...`}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
                  </Pressable>
                );
              }

              return (
                <View key={info.key} style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
                    {info.label} {info.isRequired ? <Text style={{ color: '#ef4444' }}>*</Text> : null}
                  </Text>
                  <TextInput
                    style={[styles.fieldInput, { color: theme.text, fontWeight: isNumeric ? '600' : '400' }]}
                    value={value}
                    keyboardType={isNumeric ? 'numeric' : 'default'}
                    onChangeText={(val) => handleTextChange(info.key, val)}
                    placeholder={`Enter ${info.label.toLowerCase()}...`}
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

      {/* Unified Option Picker Modal */}
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

            <ScrollView style={{ maxHeight: 350 }}>
              {activePicker?.options.map((opt) => {
                const isSelected = activePicker.paramName === '__event__'
                  ? action?.name === opt.value
                  : params[activePicker.paramName] === opt.value;

                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      if (activePicker.paramName === '__event__') {
                        const eventObj = PLAN5_EVENT_MOTIONS.find((e) => e.actionName === opt.value);
                        if (eventObj) {
                          onSelectEvent?.({
                            name: eventObj.actionName,
                            purpose: eventObj.whatHappened,
                            params: eventObj.params,
                          });
                        }
                      } else {
                        handleTextChange(activePicker.paramName, opt.value);
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
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: isSelected ? '700' : '500', color: isSelected ? theme.primary : theme.text }}>
                        {opt.label}
                      </Text>
                      {opt.subtitle ? (
                        <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{opt.subtitle}</Text>
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
  cancelBtn: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
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
  fieldLabel: {
    width: 100,
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
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
