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
  Image,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatCompletion } from '@/lib/ai';
import { getStockHistory, findProduct, updateStock } from '@/lib/inventory';

export const ITEM_SUBTYPES = [
  { label: 'Product', value: 'Product', subtitle: 'Physical Goods & Merchandise' },
  { label: 'Listing', value: 'Listing', subtitle: 'Catalog, Real Estate, Subscription' },
  { label: 'Service', value: 'Service', subtitle: 'Time-based Offerings & Appointments' },
  { label: 'Document', value: 'Document', subtitle: 'Files, Contracts, Receipts' },
  { label: 'Asset', value: 'Asset', subtitle: 'Equipment, Tools, Machinery' },
  { label: 'Warehouse', value: 'Warehouse', subtitle: 'Storage, Depot, Physical Location' },
];

export interface ItemDataPayload {
  id?: string;
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
  committed?: number;
}

export interface ItemComposeModalProps {
  visible: boolean;
  theme: any;
  submitting: boolean;
  resultMessage: string | null;
  initialType?: string;
  initialData?: Partial<ItemDataPayload> & { value?: number; data?: any };
  mode?: 'create' | 'view' | 'edit';
  scope?: string;
  onClose: () => void;
  onSave: (itemData: ItemDataPayload) => void;
  onDelete?: (id: string) => void;
  onLogEventForEntity?: (actionName: string, initialParams: Record<string, string>) => void;
}

export default function ItemComposeModal({
  visible,
  theme,
  submitting,
  resultMessage,
  initialType = 'Product',
  initialData,
  mode: propMode,
  scope,
  onClose,
  onSave,
  onDelete,
  onLogEventForEntity,
}: ItemComposeModalProps) {
  const insets = useSafeAreaInsets();

  const [currentMode, setCurrentMode] = useState<'create' | 'view' | 'edit'>('create');
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
  const [committed, setCommitted] = useState(0);
  const [locationsMap, setLocationsMap] = useState<Record<string, number>>({});

  const [showTypePicker, setShowTypePicker] = useState(false);
  const [aiFilling, setAiFilling] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState('');
  const [imageGenerating, setImageGenerating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // History motions state
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (visible) {
      const dataObj = initialData?.data ? (typeof initialData.data === 'string' ? JSON.parse(initialData.data) : initialData.data) : initialData;
      const initialStockVal = initialData?.value !== undefined ? initialData.value : (dataObj?.stock ?? 0);

      const computedMode = propMode || (initialData?.id ? 'view' : 'create');
      setCurrentMode(computedMode);

      setTitle(initialData?.title || dataObj?.title || '');
      setSubType(dataObj?.item_subtype || initialData?.item_subtype || initialType || 'Product');
      setPrice(dataObj?.price !== undefined && dataObj.price > 0 ? String(dataObj.price) : '');
      setStock(initialStockVal !== undefined ? String(initialStockVal) : '');
      setSku(dataObj?.sku || '');
      setCategory(dataObj?.category || '');
      setMinStock(dataObj?.min !== undefined && dataObj.min > 0 ? String(dataObj.min) : '');
      setUnit(dataObj?.unit || 'pcs');
      setImageUrl(dataObj?.image_url || '');
      setTempImageUrl(dataObj?.image_url || '');
      setRefUrl(dataObj?.refUrl || '');
      setDescription(dataObj?.description || '');
      setNotes(dataObj?.notes || '');
      setCommitted(Number(dataObj?.committed || 0));
      setLocationsMap(dataObj?.locations && typeof dataObj.locations === 'object' ? dataObj.locations : {});
      setShowMenu(false);

      const targetIdOrTitle = initialData?.id || initialData?.title;
      if (targetIdOrTitle && scope) {
        fetchLiveProductAndHistory(targetIdOrTitle);
      } else {
        setStockHistory([]);
      }
    }
  }, [visible, initialData?.id, initialData?.title, propMode, scope]);

  const fetchLiveProductAndHistory = async (identifier: string) => {
    if (!scope || !identifier) return;
    if (stockHistory.length === 0) {
      setLoadingHistory(true);
    }
    console.log(`[ItemComposeModal] 🔄 Fetching live product data & history for: "${identifier}"`);
    try {
      const liveProduct = await findProduct(scope, identifier);
      if (liveProduct) {
        const liveQty = liveProduct.value !== undefined ? liveProduct.value : 0;
        let liveData: any = {};
        if (typeof liveProduct.data === 'string') {
          try { liveData = JSON.parse(liveProduct.data) || {}; } catch (_) {}
        } else if (liveProduct.data && typeof liveProduct.data === 'object') {
          liveData = liveProduct.data;
        }

        console.log(`[ItemComposeModal] 🎯 Live product sync: "${liveProduct.title}" (id: ${liveProduct.id}), value/stock: ${liveQty}`);
        setStock(String(liveQty));
        if (liveProduct.title) setTitle(liveProduct.title);
        if (liveProduct.type) setSubType(liveProduct.type.charAt(0).toUpperCase() + liveProduct.type.slice(1));
        if (liveData.price !== undefined) setPrice(String(liveData.price));
        if (liveData.sku) setSku(liveData.sku);
        if (liveData.category) setCategory(liveData.category);
        if (liveData.min !== undefined) setMinStock(String(liveData.min));
        if (liveData.unit) setUnit(liveData.unit);
        if (liveData.image_url) {
          setImageUrl(liveData.image_url);
          setTempImageUrl(liveData.image_url);
        }
        if (liveData.description) setDescription(liveData.description);
        if (liveData.notes) setNotes(liveData.notes);
        if (liveData.committed) setCommitted(Number(liveData.committed));
        if (liveData.locations && typeof liveData.locations === 'object') {
          setLocationsMap(liveData.locations);
        }
      }

      const history = await getStockHistory(scope, identifier);
      setStockHistory(history);
    } catch (err) {
      console.warn('[ItemComposeModal] Error fetching live product & history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleQuickStockStep = async (stepDelta: number) => {
    const targetId = initialData?.id || initialData?.title || title;
    if (!scope || !targetId) return;
    console.log(`[ItemComposeModal] ⚡ Quick stock step clicked: delta=${stepDelta} for "${targetId}"`);
    try {
      const newStock = await updateStock(
        scope,
        targetId,
        stepDelta,
        stepDelta > 0 ? 'restock' : 'adjust',
        stepDelta > 0 ? `Quick Add (+${stepDelta})` : `Quick Adjustment (${stepDelta})`
      );
      setStock(String(newStock));
      fetchLiveProductAndHistory(targetId);
    } catch (err) {
      console.warn('[ItemComposeModal] Quick stock step warning:', err);
    }
  };

  if (!visible) return null;

  const isFormValid = title.trim().length > 0;

  const handleSave = () => {
    if (!isFormValid || submitting) return;
    const payload = {
      id: initialData?.id,
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
      committed,
    };
    console.log(`[ItemComposeModal] 💾 Save triggered — mode: "${currentMode}", title: "${title}", price: ${price}, stock: ${stock}`);
    console.log(`[ItemComposeModal] 📤 Payload built:`, payload);
    onSave(payload);
    console.log(`[ItemComposeModal] ✅ Item save submitted!`);
  };

  const handleAiImageSuggestion = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title first so AI can suggest a matching image.');
      return;
    }
    setImageGenerating(true);
    try {
      const prompt = `Suggest one high-quality, relevant Unsplash photo URL for an item of sub-type "${subType}" with title: "${title}".
Respond strictly in JSON format with exactly one key "image_url".
Example response:
{
  "image_url": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500"
}`;
      const resText = await chatCompletion(
        'You are an expert catalog design assistant that searches and provides relevant Unsplash image URLs.',
        prompt
      );
      const jsonStr = resText.substring(resText.indexOf('{'), resText.lastIndexOf('}') + 1);
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        if (parsed.image_url) {
          setImageUrl(parsed.image_url);
          setTempImageUrl(parsed.image_url);
          setShowImagePicker(false);
        }
      }
    } catch (err) {
      console.error('[ItemComposeModal] AI Image suggestion error:', err);
      Alert.alert('AI Error', 'Failed to generate/find an image for this title.');
    } finally {
      setImageGenerating(false);
    }
  };

  const handleAiAutoFill = async () => {
    if (!title.trim() || aiFilling) return;
    setAiFilling(true);
    try {
      const prompt = `Analyze this item title: "${title}". Sub-Type: ${subType}.
Notes/Context: ${notes || description || 'None'}.

STRICT CATEGORY TAXONOMY RULES:
- Use standard industry format: "Main Category / Subcategory" (e.g. "Food & Beverage / Pizza", "Food & Beverage / Beverages", "Electronics / Audio", "Apparel / Men", "Services / Consulting").
- For restaurant & cafe dishes (e.g. "Mexican pizza", "Cheeseburger", "Matcha Latte"), ALWAYS classify as fresh menu item under "Food & Beverage / [Dish Type]" (e.g., "Food & Beverage / Pizza"). NEVER misclassify prepared food as "Frozen Food" or "Grocery".
- Do NOT use '>' or raw symbols. Always use clean Title Case.

Respond strictly in valid JSON format:
{
  "category": "Food & Beverage / Pizza",
  "sku": "SKU-CODE",
  "unit": "pcs",
  "image_url": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500",
  "description": "Clean 2-3 sentence item description."
}`;

      const resText = await chatCompletion(
        'You are a standardized retail & POS catalog assistant. Strictly follow category standards.',
        prompt
      );

      const jsonStr = resText.substring(resText.indexOf('{'), resText.lastIndexOf('}') + 1);
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
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
        if (parsed.sku) setSku(String(parsed.sku));
        if (parsed.unit) setUnit(String(parsed.unit));
        if (parsed.image_url && !imageUrl) {
          setImageUrl(String(parsed.image_url));
          setTempImageUrl(String(parsed.image_url));
        }
        if (parsed.description) setDescription(String(parsed.description));
      }
    } catch (err) {
      console.error('[ItemComposeModal] AI Auto-Fill error:', err);
    } finally {
      setAiFilling(false);
    }
  };

  const onHandNum = Number(stock || 0);
  const availableNum = Math.max(0, onHandNum - committed);

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
          {/* Top Bar (Only rendered for EDIT and CREATE modes) */}
          {currentMode !== 'view' && (
            <View style={[styles.headerBar, { borderBottomColor: theme.border }]}>
              {currentMode === 'edit' ? (
                <>
                  <TouchableOpacity onPress={() => setCurrentMode('view')} hitSlop={8}>
                    <Text style={{ fontSize: 16, color: theme.textMuted }}>Cancel</Text>
                  </TouchableOpacity>

                  <Text style={[styles.headerPillText, { color: theme.text }]}>Edit Product</Text>

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
                </>
              ) : (
                /* CREATE Mode Top Bar */
                <>
                  <Pressable
                    onPress={() => setShowTypePicker(true)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.headerPill, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Text style={[styles.headerPillText, { color: theme.text }]}>{subType}</Text>
                    <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
                  </Pressable>

                  <View style={styles.rightActions}>
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
                </>
              )}
            </View>
          )}

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
              <Text style={{ fontSize: 13, fontWeight: '600', color: resultMessage.includes('Error') || resultMessage.includes('Failed') ? '#dc2626' : '#16a34a', flex: 1 }}>
                {resultMessage}
              </Text>
            </View>
          )}

          {/* Scroll Area */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollBody, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* VIEW MODE UI */}
            {currentMode === 'view' ? (
              <View style={{ gap: 14 }}>
                {/* Hero Product Card with Three-Dots Menu on Right */}
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 4 }}>
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.viewHeroImage} />
                  ) : (
                    <View style={[styles.viewHeroImage, { backgroundColor: theme.border + '20', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="cube-outline" size={28} color={theme.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, flex: 1, marginRight: 6 }} numberOfLines={2}>{title}</Text>
                      <TouchableOpacity onPress={() => setShowMenu(true)} hitSlop={12} style={{ padding: 2, marginTop: -2 }}>
                        <Ionicons name="ellipsis-vertical" size={20} color={theme.text} />
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '600' }}>{category || subType}</Text>
                    {sku ? (
                      <Text style={{ fontSize: 12, color: theme.textMuted, fontWeight: '500', marginTop: 1 }}>
                        {sku}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Stock Stats — ON HAND + AVAILABLE only */}
                <View style={[styles.minimalInventoryContainer, { borderTopColor: theme.border + '25', borderBottomColor: theme.border + '25' }]}>
                  <View style={{ flexDirection: 'row', gap: 24 }}>
                    <View style={{ gap: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>On Hand</Text>
                      <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text }}>{onHandNum} <Text style={{ fontSize: 14, fontWeight: '400' }}>{unit}</Text></Text>
                    </View>
                    <View style={{ gap: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Available</Text>
                      <Text style={{ fontSize: 22, fontWeight: '700', color: availableNum <= (Number(minStock) || 0) && Number(minStock) > 0 ? '#dc2626' : '#16a34a' }}>
                        {availableNum} <Text style={{ fontSize: 14, fontWeight: '400', color: theme.textMuted }}>{unit}</Text>
                      </Text>
                    </View>
                  </View>

                  {/* Locations Breakdown — single line, only if exists */}
                  {Object.keys(locationsMap).length > 0 ? (
                    <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 8 }}>
                      {Object.entries(locationsMap).map(([loc, qty]) => `${loc}: ${qty} ${unit}`).join('  ·  ')}
                    </Text>
                  ) : null}

                  {/* Action Buttons */}
                  <View style={[styles.minimalActionsRow, { marginTop: 10 }]}>
                    <TouchableOpacity
                      onPress={() => onLogEventForEntity?.('action_adjust_stock', { product_id: initialData?.id || title, qty: '1', reason: 'Manual Adjustment' })}
                      style={[styles.minimalPillBtn, { backgroundColor: theme.primary + '12' }]}
                    >
                      <Ionicons name="swap-vertical" size={13} color={theme.primary} />
                      <Text style={[styles.minimalPillText, { color: theme.primary }]}>Adjust</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onLogEventForEntity?.('action_receive_po', { product_id: initialData?.id || title, qty: '10' })}
                      style={[styles.minimalPillBtn, { backgroundColor: '#10b98112' }]}
                    >
                      <Ionicons name="add" size={15} color="#10b981" />
                      <Text style={[styles.minimalPillText, { color: '#10b981' }]}>Receive</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onLogEventForEntity?.('action_transfer_stock', { product_id: initialData?.id || title, from_loc: 'Main Storage', to_loc: 'Front Counter', qty: '1' })}
                      style={[styles.minimalPillBtn, { backgroundColor: theme.border + '20' }]}
                    >
                      <Ionicons name="paper-plane-outline" size={13} color={theme.text} />
                      <Text style={[styles.minimalPillText, { color: theme.text }]}>Transfer</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* History Section — Ultra-Minimal Single Line & Top 5 Limit */}
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textMuted }}>History</Text>
                    <TouchableOpacity
                      onPress={() => onLogEventForEntity?.('action_adjust_stock', { product_id: initialData?.id || title, qty: '1' })}
                      hitSlop={8}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.primary }}>+ Log Event</Text>
                    </TouchableOpacity>
                  </View>

                  {loadingHistory ? (
                    <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 8 }} />
                  ) : stockHistory.length > 0 ? (
                    stockHistory.slice(0, 5).map((item, idx) => {
                      if (!item) return null;
                      let dataObj: any = {};
                      if (typeof item.data === 'string') {
                        try { dataObj = JSON.parse(item.data); } catch (_) {}
                      } else if (item.data && typeof item.data === 'object') {
                        dataObj = item.data;
                      }
                      const deltaVal = dataObj.delta !== undefined ? dataObj.delta : 0;
                      const isTransfer = (item.type || '').toLowerCase() === 'transfer' || (dataObj.reason || '').toLowerCase().includes('transfer');
                      let displayQty = dataObj.transferQty || Math.abs(deltaVal) || 0;
                      let labelText = dataObj.reason || item.type || 'Event logged';

                      if (isTransfer) {
                        if (dataObj.fromLoc && dataObj.toLoc) {
                          labelText = `${dataObj.fromLoc} → ${dataObj.toLoc}`;
                        } else {
                          const locMatch = labelText.match(/from\s+(.*?)\s+to\s+(.*)/i);
                          if (locMatch) {
                            labelText = `${locMatch[1]} → ${locMatch[2]}`;
                          } else {
                            labelText = 'Stock Transfer';
                          }
                        }

                        if (!displayQty || displayQty === 0) {
                          const qtyMatch = (dataObj.reason || '').match(/(\d+)\s*pcs/i);
                          if (qtyMatch) {
                            displayQty = parseInt(qtyMatch[1], 10);
                          }
                        }
                      }

                      return (
                        <View key={item.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border + '20' }}>
                          <Text style={{ fontSize: 13, fontWeight: '500', color: theme.text, flex: 1, marginRight: 8 }} numberOfLines={1}>
                            {labelText}
                          </Text>
                          {isTransfer ? (
                            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary }}>⇄ {displayQty} {unit}</Text>
                          ) : deltaVal !== 0 ? (
                            <Text style={{ fontSize: 13, fontWeight: '700', color: deltaVal > 0 ? '#10b981' : '#dc2626' }}>
                              {deltaVal > 0 ? `+${deltaVal}` : `${deltaVal}`} {unit}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })
                  ) : (
                    <Text style={{ fontSize: 12, color: theme.textMuted, fontStyle: 'italic' }}>No history yet.</Text>
                  )}
                </View>
              </View>
            ) : (
              /* CREATE & EDIT FORM MODES */
              <>
                {/* Title & Image Row */}
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16, marginTop: 8 }}>
                  <Pressable
                    onPress={() => {
                      setTempImageUrl(imageUrl);
                      setShowImagePicker(true);
                    }}
                    style={({ pressed }) => [
                      styles.imageUploadCard,
                      {
                        borderColor: imageUrl ? 'transparent' : theme.border,
                        backgroundColor: theme.border + '15',
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.thumbnailImage} />
                    ) : (
                      <View style={styles.thumbnailPlaceholder}>
                        <Ionicons name="camera-outline" size={20} color={theme.textMuted} />
                        <Text style={[styles.uploadText, { color: theme.textMuted }]}>Upload</Text>
                      </View>
                    )}
                  </Pressable>

                  <View style={[styles.fieldBlock, { flex: 1, borderBottomColor: theme.border }]}>
                    {title.length > 0 && <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Title *</Text>}
                    <TextInput
                      style={[styles.fieldInput, { color: theme.text, fontWeight: '600', fontSize: 17 }]}
                      value={title}
                      onChangeText={setTitle}
                      placeholder="Title *"
                      placeholderTextColor={theme.textMuted + '80'}
                    />
                  </View>
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
                    <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
                      {subType === 'Service' ? 'Capacity / Slots' : 'Stock Qty'} {currentMode === 'edit' ? '(Read-only)' : ''}
                    </Text>
                    {currentMode === 'edit' ? (
                      <View style={{ paddingVertical: 6 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{stock || '0'}</Text>
                        <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 2, fontStyle: 'italic' }}>
                          Use Adjust or Receive Stock events to modify inventory
                        </Text>
                      </View>
                    ) : (
                      <TextInput
                        style={[styles.fieldInput, { color: theme.text }]}
                        value={stock}
                        keyboardType="numeric"
                        onChangeText={setStock}
                        placeholder={subType === 'Service' ? 'Capacity / Slots' : 'Stock Qty'}
                        placeholderTextColor={theme.textMuted + '80'}
                      />
                    )}
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
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Bottom Sheet Drawer Modal for Options */}
        <Modal
          visible={showMenu}
          transparent
          animationType="slide"
          onRequestClose={() => setShowMenu(false)}
        >
          <Pressable style={styles.drawerBackdrop} onPress={() => setShowMenu(false)}>
            <Pressable style={[styles.drawerContainer, { backgroundColor: theme.backgroundElement || theme.background }]}>
              <View style={[styles.drawerDragHandle, { backgroundColor: theme.border + '80' }]} />

              <Text style={[styles.drawerTitle, { color: theme.textMuted }]}>PRODUCT OPTIONS</Text>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  setShowMenu(false);
                  setCurrentMode('edit');
                }}
              >
                <Ionicons name="create-outline" size={20} color={theme.text} />
                <Text style={[styles.drawerItemText, { color: theme.text }]}>Edit Product</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  setShowMenu(false);
                  if (initialData?.id && onDelete) {
                    Alert.alert(
                      'Delete Product',
                      `Are you sure you want to delete "${title}"?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => onDelete(initialData.id!),
                        },
                      ]
                    );
                  }
                }}
              >
                <Ionicons name="trash-outline" size={20} color="#dc2626" />
                <Text style={[styles.drawerItemText, { color: '#dc2626' }]}>Delete Product</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  setShowMenu(false);
                  onClose();
                }}
              >
                <Ionicons name="close-circle-outline" size={20} color={theme.textMuted} />
                <Text style={[styles.drawerItemText, { color: theme.textMuted }]}>Close Product Screen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.drawerCancelBtn, { backgroundColor: theme.border + '20' }]}
                onPress={() => setShowMenu(false)}
              >
                <Text style={[styles.drawerCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

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

        {/* Image Upload/Source Picker Modal */}
        <Modal
          visible={showImagePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowImagePicker(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowImagePicker(false)}>
            <Pressable style={[styles.pickerContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: theme.text }]}>Cover Photo</Text>
                <Pressable onPress={() => setShowImagePicker(false)}>
                  <Ionicons name="close" size={20} color={theme.textMuted} />
                </Pressable>
              </View>

              <View style={{ gap: 16, marginTop: 8 }}>
                {/* Option: Paste URL */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 }}>Paste Image URL</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      style={[styles.urlInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.border + '10' }]}
                      value={tempImageUrl}
                      onChangeText={setTempImageUrl}
                      placeholder="https://example.com/image.jpg"
                      placeholderTextColor={theme.textMuted + '80'}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={[styles.applyUrlBtn, { backgroundColor: theme.primary }]}
                      onPress={() => {
                        setImageUrl(tempImageUrl.trim());
                        setShowImagePicker(false);
                      }}
                    >
                      <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 13 }}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginVertical: 4 }} />

                {/* Option: Generate with AI */}
                <TouchableOpacity
                  onPress={handleAiImageSuggestion}
                  disabled={imageGenerating || !title.trim()}
                  style={[styles.imageOptionBtn, { backgroundColor: theme.border + '15', opacity: title.trim() ? 1 : 0.4 }]}
                >
                  {imageGenerating ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Ionicons name="sparkles" size={18} color={theme.primary} />
                  )}
                  <Text style={[styles.imageOptionText, { color: theme.text }]}>
                    {imageGenerating ? 'AI Suggesting...' : 'Find matching image with AI'}
                  </Text>
                </TouchableOpacity>

                {/* Option: Default Sample Image */}
                <TouchableOpacity
                  onPress={() => {
                    const samples: Record<string, string> = {
                      Product: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
                      Listing: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=500',
                      Service: 'https://images.unsplash.com/photo-1521791136368-1a8b27477d15?w=500',
                      Document: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=500',
                      Asset: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500',
                      Warehouse: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500',
                    };
                    const sampleUrl = samples[subType] || samples.Product;
                    setImageUrl(sampleUrl);
                    setTempImageUrl(sampleUrl);
                    setShowImagePicker(false);
                  }}
                  style={[styles.imageOptionBtn, { backgroundColor: theme.border + '15' }]}
                >
                  <Ionicons name="image-outline" size={18} color={theme.text} />
                  <Text style={[styles.imageOptionText, { color: theme.text }]}>Use default sample image</Text>
                </TouchableOpacity>

                {imageUrl ? (
                  <TouchableOpacity
                    onPress={() => {
                      setImageUrl('');
                      setTempImageUrl('');
                      setShowImagePicker(false);
                    }}
                    style={[styles.imageOptionBtn, { backgroundColor: '#fef2f2' }]}
                  >
                    <Ionicons name="trash-outline" size={18} color="#dc2626" />
                    <Text style={[styles.imageOptionText, { color: '#dc2626' }]}>Remove current image</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </Pressable>
          </Pressable>
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
    paddingTop: 12,
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
  imageUploadCard: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  urlInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  applyUrlBtn: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
  },
  imageOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  viewHeroImage: {
    width: 72,
    height: 72,
    borderRadius: 14,
    resizeMode: 'cover',
  },
  inventoryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  inventoryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inventoryCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  inventoryMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricBox: {
    flex: 1,
    minWidth: '45%',
    padding: 8,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  stockActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  stockActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  stockActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  minimalInventoryContainer: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  minimalMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  minimalMetricItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  minimalMetricLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  minimalMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  minimalActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  minimalPillBtn: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  minimalPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  drawerContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 8,
  },
  drawerDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  drawerTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  drawerItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  drawerCancelBtn: {
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  drawerCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
