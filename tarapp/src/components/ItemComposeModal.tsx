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

export const ITEM_SUBTYPES = [
  { label: 'Product', value: 'Product', subtitle: 'Physical Goods & Merchandise' },
  { label: 'Listing', value: 'Listing', subtitle: 'Catalog, Real Estate, Subscription' },
  { label: 'Service', value: 'Service', subtitle: 'Time-based Offerings & Appointments' },
  { label: 'Document', value: 'Document', subtitle: 'Files, Contracts, Receipts' },
  { label: 'Asset', value: 'Asset', subtitle: 'Equipment, Tools, Machinery' },
];

export interface ItemComposeModalProps {
  visible: boolean;
  theme: any;
  submitting: boolean;
  resultMessage: string | null;
  initialType?: string;
  onClose: () => void;
  onSave: (itemData: {
    title: string;
    item_subtype: string;
    price: number;
    stock: number;
    category: string;
    refUrl?: string;
    notes?: string;
  }) => void;
}

export default function ItemComposeModal({
  visible,
  theme,
  submitting,
  resultMessage,
  initialType = 'Product',
  onClose,
  onSave,
}: ItemComposeModalProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [subType, setSubType] = useState(initialType);
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('');
  const [refUrl, setRefUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setSubType(initialType || 'Product');
      setPrice('');
      setStock('');
      setCategory('');
      setRefUrl('');
      setNotes('');
    }
  }, [visible, initialType]);

  if (!visible) return null;

  const isFormValid = title.trim().length > 0;

  const handleSave = () => {
    if (!isFormValid || submitting) return;
    onSave({
      title: title.trim(),
      item_subtype: subType,
      price: parseFloat(price) || 0,
      stock: parseInt(stock) || 0,
      category: category.trim(),
      refUrl: refUrl.trim(),
      notes: notes.trim(),
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
            {/* Left Item Sub-Type Selector Pill */}
            <Pressable
              onPress={() => setShowTypePicker(true)}
              style={({ pressed }) => [
                styles.headerPill,
                { backgroundColor: theme.primary + '15', opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.headerPillText, { color: theme.primary }]}>
                {subType}
              </Text>
              <Ionicons name="chevron-down" size={14} color={theme.primary} />
            </Pressable>

            {/* Right Save Action */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={submitting || !isFormValid}
              hitSlop={8}
              style={[styles.saveBtn, { opacity: isFormValid && !submitting ? 1 : 0.4 }]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[styles.saveText, { color: theme.primary }]}>Save</Text>
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
            {/* Row 1: Title Input */}
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <TextInput
                style={[styles.fieldInput, { color: theme.text, fontWeight: '500' }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Title *"
                placeholderTextColor={theme.textMuted + '80'}
              />
            </View>



            {/* Row 3: Price / Rate */}
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <TextInput
                style={[styles.fieldInput, { color: theme.text, fontWeight: '600' }]}
                value={price}
                keyboardType="numeric"
                onChangeText={setPrice}
                placeholder="Price ($)"
                placeholderTextColor={theme.textMuted + '80'}
              />
            </View>

            {/* Row 4: Dynamic Sub-Type Field (Stock / Duration / File Ref) */}
            {subType === 'Document' ? (
              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <TextInput
                  style={[styles.fieldInput, { color: theme.text }]}
                  value={refUrl}
                  onChangeText={setRefUrl}
                  placeholder="File URL or Reference"
                  placeholderTextColor={theme.textMuted + '80'}
                />
              </View>
            ) : (
              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <TextInput
                  style={[styles.fieldInput, { color: theme.text }]}
                  value={stock}
                  keyboardType="numeric"
                  onChangeText={setStock}
                  placeholder={subType === 'Service' ? 'Duration (mins)' : 'Stock / Quantity'}
                  placeholderTextColor={theme.textMuted + '80'}
                />
              </View>
            )}

            {/* Row 5: Category / SKU */}
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                value={category}
                onChangeText={setCategory}
                placeholder="Category / SKU"
                placeholderTextColor={theme.textMuted + '80'}
              />
            </View>

            {/* Row 6: Description & Notes */}
            <View style={styles.bodyContainer}>
              <TextInput
                style={[styles.bodyInput, { color: theme.text }]}
                multiline
                value={notes}
                onChangeText={setNotes}
                placeholder="Compose item description, specifications, or notes..."
                placeholderTextColor={theme.textMuted + '80'}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* Item Sub-Type Picker Modal */}
      <Modal
        visible={showTypePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTypePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTypePicker(false)}>
          <Pressable style={[styles.pickerContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Item Sub-Type</Text>
              <Pressable onPress={() => setShowTypePicker(false)}>
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              {ITEM_SUBTYPES.map((typeObj) => {
                const isSelected = subType === typeObj.value;
                return (
                  <Pressable
                    key={typeObj.value}
                    onPress={() => {
                      setSubType(typeObj.value);
                      setShowTypePicker(false);
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
                        {typeObj.label}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                        {typeObj.subtitle}
                      </Text>
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
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerPillText: {
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  saveBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  saveText: {
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
    marginBottom: 10,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
