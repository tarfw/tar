import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Dimensions, Modal, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { id } from '@instantdb/react-native';
import db from '../../db';

const INFOBAR_HEIGHT = 60;

interface OptionValue {
  label: string;
  identifier?: string;
}

interface OptionGroup {
  name: string;
  values: OptionValue[];
}

interface ProductsTerminalProps {
  selectedProduct?: any;
  onProductChange?: (product: any) => void;
}

export default function ProductsTerminal({ selectedProduct, onProductChange }: ProductsTerminalProps) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [img, setImg] = useState('');
  const [medias, setMedias] = useState('');

  // State for expanded items
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // State for info bar messages
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // State for loading
  const [isLoading, setIsLoading] = useState(false);
  const prevSelectedProductRef = useRef<any>(null);

  // State for modal
  const [isModalVisible, setIsModalVisible] = useState(false);

  // State for options
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [groups, setGroups] = useState<OptionGroup[]>([]);

  // Fetch total products count for dashboard
  const { data: totalProductsData } = db.useQuery({
    products: {
      $: {
        limit: 1000 // Get all products for count
      }
    }
  });

  // Fetch linked items for the selected product
  const { data: productItemsData } = db.useQuery(
    selectedProduct ? {
      items: {
        $: {
          where: { 'product.id': selectedProduct.id },
          limit: 50
        },
        inventory: {
          locations: {}
        }
      }
    } : {}
  );

  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    // Check if selectedProduct actually changed
    const selectedProductChanged = prevSelectedProductRef.current?.id !== selectedProduct?.id ||
                                   prevSelectedProductRef.current === null && selectedProduct !== null ||
                                   prevSelectedProductRef.current !== null && selectedProduct === null;

    if (!selectedProductChanged) {
      return;
    }

    // Update the ref
    prevSelectedProductRef.current = selectedProduct;

    // Update form data instantly
    if (selectedProduct) {
      setTitle(selectedProduct.title || '');
      setStatus(selectedProduct.status || '');
      setType(selectedProduct.type || '');
      setVendor(selectedProduct.vendor || '');
      setNotes(selectedProduct.notes || '');
      setImg(selectedProduct.img || '');
      setMedias(selectedProduct.medias || '');
    try {
      const parsed = selectedProduct.options && selectedProduct.options.trim() ? JSON.parse(selectedProduct.options) : {};
      
      // Convert to OptionGroup[] from compact format
      // Supports: string "Blue" OR array ["Blue", "B"] OR old object format {"label": "Blue", "identifier": "B"}
      const parsedGroups: OptionGroup[] = Object.entries(parsed).map(([name, values]: [string, any]) => {
        let optionValues: OptionValue[] = [];
        
        if (Array.isArray(values)) {
          optionValues = values.map(v => {
            // New compact format: string or [label, identifier]
            if (typeof v === 'string') {
              return { label: v, identifier: '' };
            } else if (Array.isArray(v)) {
              return { label: v[0] || '', identifier: v[1] || '' };
            }
            // Old format: {label: "Blue", identifier: "B"}
            else if (v && typeof v === 'object') {
              return { label: v.label || '', identifier: v.identifier || '' };
            }
            return { label: '', identifier: '' };
          });
        }
        
        return { name, values: optionValues };
      });
      
      setGroups(parsedGroups);
    } catch (e) {
      console.error('Failed to parse options:', e);
      setGroups([]);
    }
    } else {
      setTitle('');
      setStatus('');
      setType('');
      setVendor('');
      setNotes('');
      setImg('');
      setMedias('');
      setGroups([]);
    }

    setHasInitialized(true);
     setIsModalVisible(false);
   }, [selectedProduct, hasInitialized]);

  const handleSave = async () => {
    if (!selectedProduct) {
      // Add mode - create new product
      try {
        await db.transact(
          db.tx.products[id()].update({
            title: title || null,
            status: status || null,
            type: type || null,
            vendor: vendor || null,
            notes: notes || null,
            img: img || null,
            medias: medias || null,
          })
        );
        setInfoMessage('Product created successfully!');
        // Reset form after successful creation
        setTitle('');
        setStatus('');
        setType('');
        setVendor('');
        setNotes('');
        setImg('');
        setMedias('');
        // Clear timeout for message
        setTimeout(() => setInfoMessage(null), 3000);
      } catch (error) {
        console.error('Create error:', error);
        setInfoMessage('Failed to create product. Please try again.');
        setTimeout(() => setInfoMessage(null), 3000);
      }
    } else {
      // Edit mode - update existing product
      try {
        await db.transact(
          db.tx.products[selectedProduct.id].update({
            title: title || null,
            status: status || null,
            type: type || null,
            vendor: vendor || null,
            notes: notes || null,
            img: img || null,
            medias: medias || null,
          })
        );
        setInfoMessage('Product saved successfully!');
        // Navigate back to dashboard
        onProductChange?.(null);
        setTimeout(() => setInfoMessage(null), 3000);
      } catch (error) {
        console.error('Save error:', error);
        setInfoMessage('Failed to save product. Please try again.');
        setTimeout(() => setInfoMessage(null), 3000);
      }
    }
  };

  const handleSaveOptions = async () => {
    if (!selectedProduct) return;
    try {
      // Convert OptionGroup[] to compact format for storage
      // Format: "Blue" (no identifier) OR ["Blue", "B"] (with identifier)
      const optionsObj: Record<string, (string | [string, string])[]> = {};
      
      groups.forEach(group => {
        optionsObj[group.name] = group.values.map(v => {
          // If identifier is empty, store just the label as string
          if (!v.identifier || v.identifier.trim() === '') {
            return v.label;
          }
          // If identifier exists, store as [label, identifier]
          return [v.label, v.identifier];
        });
      });
      
      await db.transact(
        db.tx.products[selectedProduct.id].merge({
          options: JSON.stringify(optionsObj),
        })
      );
      setIsOptionsModalVisible(false);
    } catch (error) {
      console.error('Save options error:', error);
    }
  };

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const totalProductsCount = totalProductsData?.products?.length || 0;
  const isAddMode = selectedProduct && selectedProduct.__addMode;
  const isEditMode = selectedProduct && !selectedProduct.__addMode;
  const isDashboardMode = !selectedProduct;
  const shouldShowInfoBar = (isEditMode || isAddMode) || infoMessage;

  return (
    <View style={styles.container}>
      {shouldShowInfoBar ? (
        <View style={styles.infobar}>
          {isEditMode ? (
            <TouchableOpacity style={styles.infobarTouchable} onPress={() => setIsModalVisible(true)}>
              <Text style={styles.infobarText}>
                {infoMessage || String(selectedProduct.title || '')}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.infobarText}>
              {infoMessage || ''}
            </Text>
          )}
          {(isEditMode || isAddMode) && (
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>{isEditMode ? 'Save' : 'Create'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {isEditMode && (
        <View style={styles.infobar}>
          <TouchableOpacity style={styles.infobarTouchable} onPress={() => setIsOptionsModalVisible(true)}>
            <Text style={styles.infobarText}>Options</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: 0 }
        ]}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        bounces={true}
        alwaysBounceVertical={true}
      >
        <View style={styles.contentWrapper}>
        {isDashboardMode && (
        <View style={styles.header}>
        <Text style={styles.title}>
            {isDashboardMode ? 'Products' : ''}
          </Text>
        {isLoading && (
        <View style={styles.loadingIndicator}>
            <Text style={styles.loadingText}>Loading...</Text>
            </View>
            )}
              </View>
            )}

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : isDashboardMode ? (
            <View style={styles.dashboard}>
              <Text style={styles.dashboardCount}>{String(totalProductsCount)}</Text>
              <Text style={styles.dashboardLabel}>Total Products</Text>
            </View>
          ) : isEditMode ? (
            <View style={styles.itemsSection}>
              {productItemsData?.items && productItemsData.items.length > 0 ? (
                <View style={styles.itemsTableContainer}>
                  {productItemsData.items.map((item, index) => {
                    const totalAvailable = item.inventory?.reduce((sum, inv) => sum + (inv.available || 0), 0) || 0;
                    const isExpanded = expandedItems.has(item.id);

                    return (
                      <View key={item.id || index}>
                        <View style={styles.itemsTableRow}>
                          <Text style={[styles.itemsTableCellText, styles.skuColumn]}>{String(item.sku || 'No SKU')}</Text>
                          <TouchableOpacity
                            style={[styles.itemsTableCellText, styles.qtyColumn, styles.qtyTouchable]}
                            onPress={() => toggleItemExpansion(item.id)}
                          >
                            <View style={styles.qtyContainer}>
                              <Text style={styles.qtyText}>
                                {String(totalAvailable)}
                              </Text>
                              <MaterialIcons
                                name={isExpanded ? "expand-less" : "expand-more"}
                                size={16}
                                color="#6b7280"
                              />
                            </View>
                          </TouchableOpacity>
                        </View>

                        {isExpanded && item.inventory && item.inventory.length > 0 && (
                          <View style={styles.expandedInventory}>
                            {item.inventory.map((inv, invIndex) => (
                              <View key={inv.id || invIndex} style={styles.itemsTableRow}>
                                <Text style={[styles.itemsTableCellText, styles.locationColumn]}>
                                  {String(inv.locations?.[0]?.name || 'Unknown Location')}
                                </Text>
                                <Text style={[styles.itemsTableCellText, styles.invQtyColumn]}>
                                  {String(inv.available || 0)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.noItemsText}>No items linked to this product</Text>
              )}
            </View>
          ) : !isModalVisible ? (
            <TouchableOpacity style={styles.tileContainer} onPress={() => setIsModalVisible(true)}>
              <MaterialIcons name="edit" size={48} color="#6b7280" />
              <Text style={styles.tileText}>Tap to add product details</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      {isModalVisible && (
        <Modal visible={true} transparent={true} animationType="none" statusBarTranslucent={true} onRequestClose={() => setIsModalVisible(false)}>
          <View style={styles.overlay} pointerEvents="box-none">
            <Pressable style={styles.backdrop} onPress={() => setIsModalVisible(false)} />
            <KeyboardAvoidingView
              style={styles.expandedContainer}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.expandedContent}>
                <View style={styles.expandedHeader}>
                  <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeButton} activeOpacity={0.7}>
                    <MaterialIcons name="close" size={24} color="#111827" />
                  </TouchableOpacity>
                  <Text style={styles.expandedTitle}>{isEditMode ? 'Edit Product' : 'Add Product'}</Text>
                </View>

                <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalContent}>
                  <TextInput
                    style={styles.notesInput}
                    value={String(title)}
                    onChangeText={setTitle}
                    placeholder="Product Title"
                  />

                  <TextInput
                    style={styles.notesInput}
                    value={String(type)}
                    onChangeText={setType}
                    placeholder="Product Type"
                  />

                  <TextInput
                    style={styles.notesInput}
                    value={String(vendor)}
                    onChangeText={setVendor}
                    placeholder="Product Vendor"
                  />

                  <TextInput
                    style={styles.notesInput}
                    value={String(img)}
                    onChangeText={setImg}
                    placeholder="Primary Image URL"
                  />

                  <TextInput
                    style={styles.notesInput}
                    value={String(medias)}
                    onChangeText={setMedias}
                    placeholder="Media URLs"
                  />

                  <TextInput
                    style={styles.notesInput}
                    value={String(notes)}
                    onChangeText={setNotes}
                    placeholder="Product Notes"
                    multiline
                    textAlignVertical="top"
                  />
                </ScrollView>

                <TouchableOpacity
                  style={styles.saveButtonModal}
                  activeOpacity={0.8}
                  onPress={() => {
                    handleSave();
                    setIsModalVisible(false);
                  }}
                >
                  <Text style={styles.saveButtonModalText}>{isEditMode ? 'Save' : 'Create'}</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}

      {isOptionsModalVisible && (
        <Modal visible={true} transparent={true} animationType="none" statusBarTranslucent={true} onRequestClose={() => setIsOptionsModalVisible(false)}>
          <View style={styles.overlay} pointerEvents="box-none">
            <Pressable style={styles.backdrop} onPress={() => setIsOptionsModalVisible(false)} />
            <KeyboardAvoidingView
              style={styles.expandedContainer}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.expandedContent}>
                <View style={styles.expandedHeader}>
                  <TouchableOpacity onPress={() => setIsOptionsModalVisible(false)} style={styles.closeButton} activeOpacity={0.7}>
                    <MaterialIcons name="close" size={24} color="#111827" />
                  </TouchableOpacity>
                  <Text style={styles.expandedTitle}>Product Options</Text>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSaveOptions}>
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  style={styles.modalScrollView} 
                  contentContainerStyle={styles.modalContent}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {groups.map((group, groupIndex) => {
                    // Ensure there's always an empty row at the end
                    const hasEmptyRow = group.values.length === 0 || 
                      (group.values[group.values.length - 1].label === '' && 
                       group.values[group.values.length - 1].identifier === '');
                    
                    const displayValues = hasEmptyRow ? group.values : [...group.values, { label: '', identifier: '' }];
                    const isColorGroup = group.name.toLowerCase() === 'color' || group.name.toLowerCase() === 'colour';
                    
                    return (
                      <View key={groupIndex} style={styles.optionTableContainer}>
                        {/* Group Header */}
                        <View style={styles.optionTableHeader}>
                          <TextInput
                            style={styles.optionHeaderInput}
                            value={group.name}
                            onChangeText={(text) => {
                              const newGroups = [...groups];
                              newGroups[groupIndex] = { ...newGroups[groupIndex], name: text };
                              setGroups(newGroups);
                            }}
                            placeholder="e.g., Color, Size, Material"
                            placeholderTextColor="#9ca3af"
                          />
                          <TouchableOpacity
                            onPress={() => {
                              const newGroups = groups.filter((_, i) => i !== groupIndex);
                              setGroups(newGroups);
                            }}
                            style={styles.deleteGroupButtonTable}
                          >
                            <MaterialIcons name="delete-outline" size={20} color="#ef4444" />
                          </TouchableOpacity>
                        </View>

                        {/* Table Rows */}
                        {displayValues.map((value, valueIndex) => {
                          const isActualValue = valueIndex < group.values.length;
                          const isEmpty = value.label === '' && (value.identifier === '' || !value.identifier);
                          const isLastRow = valueIndex === displayValues.length - 1;
                          
                          return (
                            <View key={valueIndex} style={[styles.tableRow, isLastRow && styles.lastTableRow]}>
                              <View style={[styles.tableColumn, styles.labelCell]}>
                                <TextInput
                                  style={styles.tableCell}
                                  value={value.label}
                                  onChangeText={(text) => {
                                    const newGroups = [...groups];
                                    if (isActualValue) {
                                      newGroups[groupIndex].values[valueIndex] = {
                                        ...newGroups[groupIndex].values[valueIndex],
                                        label: text
                                      };
                                    } else {
                                      // Creating new row from empty row
                                      newGroups[groupIndex].values.push({ label: text, identifier: '' });
                                    }
                                    setGroups(newGroups);
                                  }}
                                  placeholder="Value"
                                  placeholderTextColor="#d1d5db"
                                />
                              </View>
                              <View style={[styles.tableColumn, isColorGroup ? styles.idCellWithPreview : styles.idCell]}>
                                <TextInput
                                  style={styles.tableCell}
                                  value={value.identifier || ''}
                                  onChangeText={(text) => {
                                    const newGroups = [...groups];
                                    if (isActualValue) {
                                      newGroups[groupIndex].values[valueIndex] = {
                                        ...newGroups[groupIndex].values[valueIndex],
                                        identifier: text
                                      };
                                    } else {
                                      // Creating new row from empty row
                                      newGroups[groupIndex].values.push({ label: '', identifier: text });
                                    }
                                    setGroups(newGroups);
                                  }}
                                  placeholder={isColorGroup ? '#HEX' : 'Code'}
                                  placeholderTextColor="#d1d5db"
                                />
                              </View>
                              {isColorGroup && (
                                <View style={[styles.tableColumn, styles.previewCell]}>
                                  {value.identifier && value.identifier.startsWith('#') && (
                                    <View style={[styles.colorPreviewTable, { backgroundColor: value.identifier }]} />
                                  )}
                                </View>
                              )}
                              <View style={[styles.tableColumn, styles.actionCell]}>
                                {isActualValue && !isEmpty && (
                                  <TouchableOpacity
                                    onPress={() => {
                                      const newGroups = [...groups];
                                      newGroups[groupIndex].values = newGroups[groupIndex].values.filter((_, i) => i !== valueIndex);
                                      setGroups(newGroups);
                                    }}
                                  >
                                    <MaterialIcons name="close" size={18} color="#9ca3af" />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}

                  {/* Add Option Group Button */}
                  {groups.length < 3 && (
                    <TouchableOpacity
                      style={styles.addGroupButtonTable}
                      onPress={() => setGroups([...groups, { name: '', values: [{ label: '', identifier: '' }] }])}
                    >
                      <MaterialIcons name="add-circle-outline" size={24} color="#3b82f6" />
                      <Text style={styles.addGroupTextTable}>Add New Option</Text>
                    </TouchableOpacity>
                  )}

                  <View style={{ height: 60 }} />
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  infobar: {
    height: INFOBAR_HEIGHT,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infobarText: {
    fontSize: 16,
    color: 'black',
    fontWeight: '600',
    flex: 1,
  },
  infobarTouchable: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: Dimensions.get('window').height + 200,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 0,
    borderBottomWidth: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 17,
  },

  tableContainer: {
    margin: 0,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    minHeight: 48,
  },
  tableCellText: {
    fontSize: 14,
    color: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  fieldColumn: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  valueColumn: {
    flex: 2,
  },
  fieldLabel: {
    fontWeight: '600',
    color: '#374151',
  },
  tableInput: {
    borderWidth: 0,
    padding: 0,
    fontSize: 14,
    color: '#1f2937',
    backgroundColor: 'transparent',
  },
  tableTextArea: {
    borderWidth: 0,
    padding: 0,
    fontSize: 14,
    color: '#1f2937',
    backgroundColor: 'transparent',
    minHeight: 60,
    textAlignVertical: 'top',
  },

  itemsSection: {
    marginTop: 0,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  itemsTableContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  itemsTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  itemsTableHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  itemsTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemsTableCellText: {
    fontSize: 14,
    color: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skuColumn: {
    flex: 2,
  },
  qtyColumn: {
    flex: 1,
  },
  noItemsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  qtyTouchable: {
    padding: 0,
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyText: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
  },
  expandedInventory: {
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  inventoryHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  inventoryHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  inventoryRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  inventoryCellText: {
    fontSize: 12,
    color: '#374151',
  },
  locationColumn: {
    flex: 2,
  },
  invQtyColumn: {
    flex: 1,
  },
  dashboard: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  dashboardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  dashboardCount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  dashboardLabel: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  contentWrapper: {
    flex: 1,
  },
  loadingIndicator: {
    position: 'absolute',
    right: 20,
    top: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  tileContainer: {
    margin: 20,
    padding: 40,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  tileText: {
    fontSize: 18,
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  expandedContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  expandedContent: {
    flex: 1,
    backgroundColor: 'white',
    marginTop: 0,
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  expandedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },

  modalContent: {
    paddingBottom: 20,
  },
  notesInput: {
    fontSize: 18,
    color: '#111827',
    lineHeight: 28,
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 24,
    textAlignVertical: 'top',
  },
  // Table-based Option Styles
  optionTableContainer: {
    marginBottom: 24,
    marginHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    overflow: 'hidden',
  },
  optionTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f9fafb',
  },
  optionHeaderInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  deleteGroupButtonTable: {
    padding: 6,
    marginLeft: 12,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  lastTableRow: {
    borderBottomWidth: 0,
  },
  tableColumn: {
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#d1d5db',
  },
  tableCell: {
    fontSize: 15,
    color: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  labelCell: {
    flex: 2,
  },
  idCell: {
    flex: 2,
  },
  idCellWithPreview: {
    flex: 1.5,
  },
  previewCell: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPreviewTable: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
  },
  actionCell: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 0,
  },

  addGroupButtonTable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'white',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
  },
  addGroupTextTable: {
    fontSize: 15,
    color: '#3b82f6',
    marginLeft: 8,
    fontWeight: '600',
  },
  modalScrollView: {
    flex: 1,
  },
  saveButtonModal: {
    backgroundColor: '#111827',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignSelf: 'center',
    marginTop: 20,
  },
  saveButtonModalText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
