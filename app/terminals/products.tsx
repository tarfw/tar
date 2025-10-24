import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import db from '../../db';

interface ProductsTerminalProps {
  selectedProduct?: any;
}

export default function ProductsTerminal({ selectedProduct }: ProductsTerminalProps) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [img, setImg] = useState('');
  const [medias, setMedias] = useState('');

  // State for expanded items
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    if (selectedProduct) {
      setTitle(selectedProduct.title || '');
      setStatus(selectedProduct.status || '');
      setType(selectedProduct.type || '');
      setVendor(selectedProduct.vendor || '');
      setNotes(selectedProduct.notes || '');
      setImg(selectedProduct.img || '');
      setMedias(selectedProduct.medias || '');
    } else {
      // Reset form when no product selected
      setTitle('');
      setStatus('');
      setType('');
      setVendor('');
      setNotes('');
      setImg('');
      setMedias('');
    }
  }, [selectedProduct]);

  const handleSave = async () => {
    if (!selectedProduct?.id) {
      Alert.alert('Error', 'No product selected to save');
      return;
    }

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
      Alert.alert('Success', 'Product saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save product. Please try again.');
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

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        bounces={true}
        alwaysBounceVertical={true}
      >
      <View style={styles.header}>
        <Text style={styles.title}>
          {selectedProduct ? 'Edit Product' : 'Products Terminal'}
        </Text>
        {selectedProduct && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        )}
      </View>

      {selectedProduct ? (
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.fieldColumn]}>Field</Text>
            <Text style={[styles.tableHeaderText, styles.valueColumn]}>Value</Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={[styles.tableCellText, styles.fieldColumn, styles.fieldLabel]}>Title</Text>
            <TextInput
              style={[styles.tableCellText, styles.valueColumn, styles.tableInput]}
              value={title}
              onChangeText={setTitle}
              placeholder="Product title"
            />
          </View>

          <View style={styles.tableRow}>
            <Text style={[styles.tableCellText, styles.fieldColumn, styles.fieldLabel]}>Status</Text>
            <TextInput
              style={[styles.tableCellText, styles.valueColumn, styles.tableInput]}
              value={status}
              onChangeText={setStatus}
              placeholder="Product status"
            />
          </View>

          <View style={styles.tableRow}>
            <Text style={[styles.tableCellText, styles.fieldColumn, styles.fieldLabel]}>Type</Text>
            <TextInput
              style={[styles.tableCellText, styles.valueColumn, styles.tableInput]}
              value={type}
              onChangeText={setType}
              placeholder="Product type"
            />
          </View>

          <View style={styles.tableRow}>
            <Text style={[styles.tableCellText, styles.fieldColumn, styles.fieldLabel]}>Vendor</Text>
            <TextInput
              style={[styles.tableCellText, styles.valueColumn, styles.tableInput]}
              value={vendor}
              onChangeText={setVendor}
              placeholder="Product vendor"
            />
          </View>

          <View style={styles.tableRow}>
            <Text style={[styles.tableCellText, styles.fieldColumn, styles.fieldLabel]}>Image URL</Text>
            <TextInput
              style={[styles.tableCellText, styles.valueColumn, styles.tableInput]}
              value={img}
              onChangeText={setImg}
              placeholder="Product image URL"
            />
          </View>

          <View style={styles.tableRow}>
            <Text style={[styles.tableCellText, styles.fieldColumn, styles.fieldLabel]}>Media URLs</Text>
            <TextInput
              style={[styles.tableCellText, styles.valueColumn, styles.tableInput]}
              value={medias}
              onChangeText={setMedias}
              placeholder="Product media URLs"
              multiline
            />
          </View>

          <View style={styles.tableRow}>
            <Text style={[styles.tableCellText, styles.fieldColumn, styles.fieldLabel]}>Notes</Text>
            <TextInput
              style={[styles.tableCellText, styles.valueColumn, styles.tableTextArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Product notes"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Linked Items Section */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Linked Items</Text>
            {productItemsData?.items && productItemsData.items.length > 0 ? (
              <View style={styles.itemsTableContainer}>
                <View style={styles.itemsTableHeader}>
                  <Text style={[styles.itemsTableHeaderText, styles.skuColumn]}>SKU</Text>
                  <Text style={[styles.itemsTableHeaderText, styles.qtyColumn]}>Available Qty</Text>
                </View>
                {productItemsData.items.map((item, index) => {
                  const totalAvailable = item.inventory?.reduce((sum, inv) => sum + (inv.available || 0), 0) || 0;
                  const isExpanded = expandedItems.has(item.id);

                  return (
                    <View key={item.id || index}>
                      <View style={styles.itemsTableRow}>
                        <Text style={[styles.itemsTableCellText, styles.skuColumn]}>{item.sku || 'No SKU'}</Text>
                        <TouchableOpacity
                          style={[styles.itemsTableCellText, styles.qtyColumn, styles.qtyTouchable]}
                          onPress={() => toggleItemExpansion(item.id)}
                        >
                          <View style={styles.qtyContainer}>
                            <Text style={styles.qtyText}>
                              {totalAvailable}
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
                          <View style={styles.inventoryHeader}>
                            <Text style={[styles.inventoryHeaderText, styles.locationColumn]}>Location</Text>
                            <Text style={[styles.inventoryHeaderText, styles.invQtyColumn]}>Available</Text>
                          </View>
                          {item.inventory.map((inv, invIndex) => (
                            <View key={inv.id || invIndex} style={styles.inventoryRow}>
                              <Text style={[styles.inventoryCellText, styles.locationColumn]}>
                                {inv.locations?.[0]?.name || 'Unknown Location'}
                              </Text>
                              <Text style={[styles.inventoryCellText, styles.invQtyColumn]}>
                                {inv.available || 0}
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
        </View>
      ) : (
        <View style={styles.emptyState}>
          <MaterialIcons name="shopping-cart" size={48} color="#d1d5db" />
          <Text style={styles.emptyStateText}>Select a product to edit</Text>
          <Text style={styles.emptyStateSubtext}>Use the # button to browse products</Text>
        </View>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
    margin: 20,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  itemsSection: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
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
});
