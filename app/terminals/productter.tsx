import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import db from '../../db';
import { generateAPIUrl } from '../../utils';

interface OptionValue {
  label: string;
  identifier: string;
}

interface OptionGroup {
  name: string;
  values: OptionValue[];
}

interface ProductterTerminalProps {
  selectedProduct?: any;
  onProductChange?: (product: any) => void;
  onRegisterSendMessage?: (handler: ((message: string) => Promise<void>) | null) => void;
}

export default function ProductterTerminal({ selectedProduct, onProductChange, onRegisterSendMessage }: ProductterTerminalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [notes, setNotes] = useState('');
  const [groups, setGroups] = useState<OptionGroup[]>([]);

  const prevSelectedProductRef = useRef<any>(null);

  // AI generation handler
  const handleAISend = useCallback(async (message: string) => {
    if (!selectedProduct || !message || typeof message !== 'string') return;

    console.log('Product AI Generate triggered with input:', message);

    try {
      const messages = [{
        id: Date.now().toString(),
        role: 'user' as const,
        content: message.trim()
      }];

      const apiUrl = generateAPIUrl('/api/products/generate');
      console.log('Making API call to:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          existingProduct: {
            title: selectedProduct.title,
            type: selectedProduct.type,
            img: selectedProduct.img,
            notes: selectedProduct.notes,
            options: selectedProduct.options
          }
        }),
      });

      console.log('API response status:', response.status, response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('API response received:', data);

        let generatedProduct = data.product;

        // Parse AI-generated structured output from text if needed
        if (!generatedProduct && data.text) {
          try {
            const jsonMatch = data.text.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[1]);

              // Handle options that come as JSON strings
              if (parsed.options && typeof parsed.options === 'string') {
                try {
                  parsed.options = JSON.parse(parsed.options);
                } catch (e) {
                  console.error('Failed to parse options string:', e);
                }
              }

              generatedProduct = parsed;
            }
          } catch (e) {
            console.error('Failed to parse AI response:', e);
          }
        }

        if (generatedProduct) {
          // Update product in database with AI-generated data
          const updateData: any = {};
          if (generatedProduct.title !== undefined) updateData.title = generatedProduct.title;
          if (generatedProduct.type !== undefined) updateData.type = generatedProduct.type;
          if (generatedProduct.notes !== undefined) updateData.notes = generatedProduct.notes;
          if (generatedProduct.options !== undefined) updateData.options = JSON.stringify(generatedProduct.options);

          await db.transact(
            db.tx.products[selectedProduct.id].update(updateData)
          );

          // Update local state immediately for instant UI feedback
          if (onProductChange) {
            onProductChange({
              ...selectedProduct,
              ...generatedProduct,
              options: generatedProduct.options ? JSON.stringify(generatedProduct.options) : selectedProduct.options
            });
          }
        }
      } else {
        const errorText = await response.text();
        console.error('AI generation failed:', response.status, errorText);
      }
    } catch (error) {
      console.error('AI generation error:', error);
    }
  }, [selectedProduct, onProductChange]);

  // Register AI send handler when component mounts
  useEffect(() => {
    if (onRegisterSendMessage) {
      onRegisterSendMessage(selectedProduct ? handleAISend : null);
    }

    return () => {
      if (onRegisterSendMessage) {
        onRegisterSendMessage(null);
      }
    };
  }, [selectedProduct, handleAISend, onRegisterSendMessage]);

  // Fetch total products count for dashboard
  const { data: totalProductsData } = db.useQuery({
    products: {
      $: {
        limit: 1000
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

  useEffect(() => {
    // Always update when selectedProduct changes
    prevSelectedProductRef.current = selectedProduct;

    if (selectedProduct) {
      setTitle(selectedProduct.title || '');
      setType(selectedProduct.type || '');
      setNotes(selectedProduct.notes || '');

      // Clean options parsing with AI-generated structured output support
      try {
        const parsed = selectedProduct.options ? JSON.parse(selectedProduct.options) : {};

        if (typeof parsed === 'object' && parsed !== null) {
          const parsedGroups: OptionGroup[] = Object.entries(parsed)
            .filter(([name, values]) => Array.isArray(values))
            .map(([name, values]: [string, any]) => ({
              name,
              values: values
                .filter((v): v is [string, string] => Array.isArray(v) && v.length >= 2)
                .map(([label, identifier]) => ({
                  label: String(label || ''),
                  identifier: String(identifier || '')
                }))
            }))
            .filter(group => group.values.length > 0);

          setGroups(parsedGroups);
        } else {
          setGroups([]);
        }
      } catch (e) {
        console.error('Failed to parse options:', e);
        setGroups([]);
      }
    } else {
      setTitle('');
      setType('');
      setNotes('');
      setGroups([]);
    }
  }, [selectedProduct]);

  const totalProductsCount = totalProductsData?.products?.length || 0;
  const isDashboardMode = !selectedProduct;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {isDashboardMode ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Products</Text>
              </View>
              <View style={styles.dashboard}>
                <Text style={styles.dashboardCount}>{String(totalProductsCount)}</Text>
                <Text style={styles.dashboardLabel}>Total Products</Text>
              </View>
            </>
          ) : (
            <>
              {/* Product Details */}
              <View style={styles.productHeader}>
                <Text style={styles.productTitle}>{title || 'Untitled Product'}</Text>
                <Text style={styles.productType}>{type || 'No type'}</Text>
              </View>

              {notes ? (
                <View style={styles.notesSection}>
                  <Text style={styles.notesTitle}>Notes</Text>
                  <Text style={styles.notesText}>{notes}</Text>
                </View>
              ) : null}

              {/* Options Table - AI Generated Structured Output */}
              {groups.length > 0 && (
                <View style={styles.optionsSection}>
                  <Text style={styles.sectionTitle}>Options</Text>
                  {groups.map((group, groupIndex) => (
                    <View key={groupIndex} style={styles.optionGroup}>
                      <Text style={styles.optionGroupTitle}>{group.name}</Text>
                      {group.values.map((value, valueIndex) => (
                        <View key={valueIndex} style={styles.optionRow}>
                          <Text style={styles.optionLabel}>{value.label}</Text>
                          <Text style={styles.optionIdentifier}>{value.identifier}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {/* Linked Items */}
              <View style={styles.itemsSection}>
                <Text style={styles.sectionTitle}>Items</Text>
                {productItemsData?.items && productItemsData.items.length > 0 ? (
                  <View style={styles.itemsContainer}>
                    {productItemsData.items.map((item, index) => {
                      const totalAvailable = item.inventory?.reduce((sum, inv) => sum + (inv.available || 0), 0) || 0;

                      return (
                        <View key={item.id || index} style={styles.itemRow}>
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemSku}>{String(item.sku || 'No SKU')}</Text>
                            <View style={styles.itemDetails}>
                              <Text style={styles.itemPrice}>${String(item.price || 0)}</Text>
                              <Text style={styles.itemStock}>Stock: {String(totalAvailable)}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.noItemsText}>No items linked to this product</Text>
                )}
              </View>
            </>
          )}
        </View>
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
    paddingBottom: 100,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  dashboard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
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
  productHeader: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  productTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  productType: {
    fontSize: 16,
    color: '#6b7280',
  },
  notesSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  notesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  optionsSection: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  optionGroup: {
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
  },
  optionGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'white',
    borderRadius: 6,
    marginBottom: 4,
  },
  optionLabel: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
  },
  optionIdentifier: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },
  itemsSection: {
    marginTop: 20,
  },
  itemsContainer: {
    gap: 8,
  },
  itemRow: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemSku: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  itemStock: {
    fontSize: 14,
    color: '#6b7280',
  },
  noItemsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
});
