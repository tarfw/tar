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
import { chatCompletion } from '@/lib/ai';

export const ITEM_SUBTYPES = [
  { label: 'Product', value: 'Product', subtitle: 'Physical Goods & Merchandise' },
  { label: 'Listing', value: 'Listing', subtitle: 'Catalog, Real Estate, Subscription' },
  { label: 'Service', value: 'Service', subtitle: 'Time-based Offerings & Appointments' },
  { label: 'Document', value: 'Document', subtitle: 'Files, Contracts, Receipts' },
  { label: 'Asset', value: 'Asset', subtitle: 'Equipment, Tools, Machinery' },
  { label: 'Warehouse', value: 'Warehouse', subtitle: 'Storage, Depot, Physical Location' },
];

export interface ItemDataPayload {
  title: string;
  item_subtype: string;
  price: number;
  stock: number;
  sku: string;
  category: string;
  min: number;
  unit: string;
  image_url: string;
  refUrl?: string;
  description?: string;
  notes?: string;
}

export interface ItemComposeModalProps {
  visible: boolean;
  theme: any;
  submitting: boolean;
  resultMessage: string | null;
  initialType?: string;
  initialData?: Partial<ItemDataPayload>;
  onClose: () => void;
  onSave: (itemData: ItemDataPayload) => void;
}

export default function ItemComposeModal({
  visible,
  theme,
  submitting,
  resultMessage,
  initialType = 'Product',
  initialData,
  onClose,
  onSave,
}: ItemComposeModalProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [subType, setSubType] = useState(initialType);
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [minStock, setMinStock] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [imageUrl, setImageUrl] = useState('');
  const [refUrl, setRefUrl] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [aiFilling, setAiFilling] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(initialData?.title || '');
      setSubType(initialData?.item_subtype || initialType || 'Product');
      setPrice(initialData?.price !== undefined && initialData.price > 0 ? String(initialData.price) : '');
      setStock(initialData?.stock !== undefined && initialData.stock > 0 ? String(initialData.stock) : '');
      setSku(initialData?.sku || '');
      setCategory(initialData?.category || '');
      setMinStock(initialData?.min !== undefined && initialData.min > 0 ? String(initialData.min) : '');
      setUnit(initialData?.unit || 'pcs');
      setImageUrl(initialData?.image_url || '');
      setRefUrl(initialData?.refUrl || '');
      setDescription(initialData?.description || '');
      setNotes(initialData?.notes || '');
    }
  }, [visible, initialType, initialData]);

  if (!visible) return null;

  const isFormValid = title.trim().length > 0;

  const handleSave = () => {
    if (!isFormValid || submitting) return;
    onSave({
      title: title.trim(),
      item_subtype: subType,
      price: parseFloat(price) || 0,
      stock: parseInt(stock) || 0,
      sku: sku.trim(),
      category: category.trim(),
      min: parseInt(minStock) || 0,
      unit: unit.trim() || 'pcs',
      image_url: imageUrl.trim(),
      refUrl: refUrl.trim(),
      description: description.trim(),
      notes: notes.trim(),
    });
  };

  // AI Auto-Fill Function (triggered by top-bar "AI" text button)
  const handleAiAutoFill = async () => {
    if (!title.trim() || aiFilling) return;
    setAiFilling(true);
    try {
      const prompt = `Analyze this item title: "${title}".
Current Sub-Type: ${subType}.
Notes/Context: ${notes || description || 'None'}.

STRICT SUB-TYPE RULES:
- Detect exact Item Sub-Type from title: "Product" (goods/food), "Service" (appointments/work), "Listing" (real estate/catalog), "Document" (files/contracts), "Asset" (machinery/tools), or "Warehouse" (storage depots).

STRICT CATEGORY TAXONOMY RULES:
- Use standard industry format: "Main Category / Subcategory" (e.g. "Food & Beverage / Pizza", "Food & Beverage / Beverages", "Electronics / Audio", "Services / Consulting").
- For restaurant & cafe dishes (e.g. "Mexican pizza", "Cheeseburger", "Matcha Latte"), ALWAYS classify under "Food & Beverage / [Dish Type]".

Respond strictly in valid JSON format:
{
  "item_subtype": "Product",
  "category": "Food & Beverage / Pizza",
  "price": 12.99,
  "stock": 10,
  "min": 3,
  "sku": "SKU-CODE",
  "unit": "pcs",
  "image_url": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500",
  "description": "Clean 2-3 sentence item description."
}`;

      const resText = await chatCompletion(
        'You are a standardized retail & POS catalog assistant. Strictly follow category and item sub-type standards.',
        prompt
      );

      const jsonStr = resText.substring(resText.indexOf('{'), resText.lastIndexOf('}') + 1);
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);

        // Auto-select Sub-Type if detected by AI
        if (parsed.item_subtype) {
          const matchedType = ITEM_SUBTYPES.find(
            (t) => t.value.toLowerCase() === String(parsed.item_subtype).toLowerCase()
          );
          if (matchedType) {
            setSubType(matchedType.value);
          }
        }

        if (parsed.category) {
          let cleanCat = String(parsed.category)
            .replace(/\s*>\s*/g, ' / ')
            .replace(/\s*-\s*/g, ' / ')
            .replace(/Frozen\s+Pizza/gi, 'Pizza')
            .replace(/Frozen\s+Food/gi, 'Food & Beverage')
            .trim();

          if (!cleanCat.includes('/') && /pizza|burger|pasta|taco|drink|coffee|tea|dessert/i.test(title)) {
            cleanCat = `Food & Beverage / ${cleanCat}`;
          }
          setCategory(cleanCat);
        }
        if (parsed.price) setPrice(String(parsed.price));
        if (parsed.stock !== undefined) setStock(String(parsed.stock));
        if (parsed.min !== undefined) setMinStock(String(parsed.min));
        if (parsed.sku) setSku(String(parsed.sku));
        if (parsed.unit) setUnit(String(parsed.unit));
        if (parsed.image_url && !imageUrl) setImageUrl(String(parsed.image_url));
        if (parsed.description) setDescription(String(parsed.description));
      }
    } catch (err) {
      console.error('[ItemComposeModal] AI Auto-Fill error:', err);
    } finally {
      setAiFilling(false);
    }
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
            {/* Sub-type text selector (tap to change item type) */}
            <Pressable
              onPress={() => setShowTypePicker(true)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.headerPill,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.headerPillText, { color: theme.text }]}>
                {subType}
              </Text>
            </Pressable>

            <View style={styles.rightActions}>
              {/* Plain Text "AI" Button at Top */}
              <TouchableOpacity
                onPress={handleAiAutoFill}
                disabled={aiFilling || !title.trim()}
                hitSlop={8}
                style={[styles.aiTextBtn, { opacity: title.trim() && !aiFilling ? 1 : 0.35 }]}
              >
                {aiFilling ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Text style={[styles.aiTextLabel, { color: theme.primary }]}>AI</Text>
                )}
              </TouchableOpacity>

              {/* Save Action */}
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
            {/* Title Input */}
            <View style={[styles.fieldBlock, { borderBottomColor: theme.border }]}>
              {title.length > 0 && <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Title *</Text>}
              <TextInput
                style={[styles.fieldInput, { color: theme.text, fontWeight: '600', fontSize: 17 }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Title *"
                placeholderTextColor={theme.textMuted + '80'}
              />
            </View>

            {/* Price & Unit Row */}
            <View style={styles.twoColumnRow}>
              <View style={[styles.fieldBlock, { flex: 1, borderBottomColor: theme.border }]}>
                {price.length > 0 && <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Price ($)</Text>}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {price.length > 0 && <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text, marginRight: 2 }}>$</Text>}
                  <TextInput
                    style={[styles.fieldInput, { flex: 1, color: theme.text, fontWeight: '600' }]}
                    value={price}
                    keyboardType="numeric"
                    onChangeText={setPrice}
                    placeholder="Price ($)"
                    placeholderTextColor={theme.textMuted + '80'}
                  />
                </View>
              </View>

              <View style={[styles.fieldBlock, { flex: 1, borderBottomColor: theme.border }]}>
                {unit.length > 0 && <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Unit</Text>}
                <TextInput
                  style={[styles.fieldInput, { color: theme.text }]}
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="Unit (pcs, kg, hr)"
                  placeholderTextColor={theme.textMuted + '80'}
                />
              </View>
            </View>

            {/* Stock & Low Stock Alert (min) Row */}
            <View style={styles.twoColumnRow}>
              <View style={[styles.fieldBlock, { flex: 1, borderBottomColor: theme.border }]}>
                {stock.length > 0 && <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{subType === 'Service' ? 'Capacity / Slots' : 'Stock Qty'}</Text>}
                <TextInput
                  style={[styles.fieldInput, { color: theme.text }]}
                  value={stock}
                  keyboardType="numeric"
                  onChangeText={setStock}
                  placeholder={subType === 'Service' ? 'Capacity / Slots' : 'Stock Qty'}
                  placeholderTextColor={theme.textMuted + '80'}
                />
              </View>

              <View style={[styles.fieldBlock, { flex: 1, borderBottomColor: theme.border }]}>
                {minStock.length > 0 && <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Min Alert Qty</Text>}
                <TextInput
                  style={[styles.fieldInput, { color: theme.text }]}
                  value={minStock}
                  keyboardType="numeric"
                  onChangeText={setMinStock}
                  placeholder="Min Alert Qty"
                  placeholderTextColor={theme.textMuted + '80'}
                />
              </View>
            </View>

            {/* SKU / Barcode & Category */}
            <View style={styles.twoColumnRow}>
              <View style={[styles.fieldBlock, { flex: 1, borderBottomColor: theme.border }]}>
                {sku.length > 0 && <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>SKU / Barcode</Text>}
                <TextInput
                  style={[styles.fieldInput, { color: theme.text }]}
                  value={sku}
                  onChangeText={setSku}
                  placeholder="SKU / Barcode"
                  placeholderTextColor={theme.textMuted + '80'}
                />
              </View>

              <View style={[styles.fieldBlock, { flex: 1, borderBottomColor: theme.border }]}>
                {category.length > 0 && <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Category</Text>}
                <TextInput
                  style={[styles.fieldInput, { color: theme.text }]}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="Category"
                  placeholderTextColor={theme.textMuted + '80'}
                />
              </View>
            </View>

            {/* Primary Image URL */}
            <View style={[styles.fieldBlock, { borderBottomColor: theme.border }]}>
              {imageUrl.length > 0 && <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Primary Image URL (Cover Photo)</Text>}
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder="Primary Image URL (Cover Photo)"
                placeholderTextColor={theme.textMuted + '80'}
              />
            </View>

            {/* Reference URL */}
            <View style={[styles.fieldBlock, { borderBottomColor: theme.border }]}>
              {refUrl.length > 0 && <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>External Reference URL / Link</Text>}
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                value={refUrl}
                onChangeText={setRefUrl}
                placeholder="External Reference URL / Link"
                placeholderTextColor={theme.textMuted + '80'}
              />
            </View>

            {/* Description Section */}
            <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 16 }]}>Description</Text>
            <View style={[styles.bodyContainer, { borderColor: theme.border }]}>
              <TextInput
                style={[styles.bodyInput, { color: theme.text }]}
                multiline
                value={description}
                onChangeText={setDescription}
                placeholder="Compose item description or specs..."
                placeholderTextColor={theme.textMuted + '80'}
                textAlignVertical="top"
              />
            </View>

            {/* Internal Notes */}
            <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 16 }]}>Internal Notes</Text>
            <View style={[styles.bodyContainer, { minHeight: 80, borderColor: theme.border }]}>
              <TextInput
                style={[styles.bodyInput, { color: theme.text, minHeight: 60 }]}
                multiline
                value={notes}
                onChangeText={setNotes}
                placeholder="Private team notes or supplier specifications..."
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
    gap: 4,
  },
  headerPillText: {
    fontSize: 16,
    fontWeight: '700',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  aiTextBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  aiTextLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  saveBtn: {
    paddingHorizontal: 4,
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
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldBlock: {
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 2,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: -2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fieldInput: {
    fontSize: 15,
    paddingVertical: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
  },
  bodyContainer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    minHeight: 120,
    marginTop: 6,
  },
  bodyInput: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 100,
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
