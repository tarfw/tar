import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import db from '../../db';
import { generateAPIUrl } from '../../utils';
import { id } from '@instantdb/react-native';

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
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [supplier, setSupplier] = useState('');
  const [groups, setGroups] = useState<OptionGroup[]>([]);

  const prevSelectedProductRef = useRef<any>(null);

  // Auto-categorization helper
  const autoCategorize = async (productTitle: string): Promise<string | null> => {
    try {
      const categorizerUrl = generateAPIUrl('/api/categorize', 'https://taragent-categorizer.tar-54d.workers.dev');
      console.log('[AutoCategorize] Calling:', categorizerUrl, 'for:', productTitle);
      
      const response = await fetch(categorizerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: productTitle })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[AutoCategorize] Response:', data);
        return data.category;
      }
      return null;
    } catch (error) {
      console.error('[AutoCategorize] Error:', error);
      return null;
    }
  };

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
        category: selectedProduct.category,
        img: selectedProduct.img,
        status: selectedProduct.status,
        supplier: selectedProduct.supplier,
          options: selectedProduct.options
          }
        }),
      });

      console.log('API response status:', response.status, response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('API response received:', data);

        let generatedProduct = data.product;
        let generatedItems = data.items || [];

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
        // Auto-categorize if category is missing
        if (!generatedProduct.category && generatedProduct.title) {
          console.log('[ProductAI] No category, auto-categorizing:', generatedProduct.title);
          const autoCategory = await autoCategorize(generatedProduct.title);
          if (autoCategory) {
            console.log('[ProductAI] Auto-category assigned:', autoCategory);
            generatedProduct.category = autoCategory;
          }
        }

        // Update product in database with AI-generated data
        const updateData: any = {};
        if (generatedProduct.title !== undefined) updateData.title = generatedProduct.title;
        if (generatedProduct.category !== undefined) updateData.category = generatedProduct.category;
        if (generatedProduct.status !== undefined) updateData.status = generatedProduct.status;
        if (generatedProduct.supplier !== undefined) updateData.supplier = generatedProduct.supplier;
        if (generatedProduct.options !== undefined) updateData.options = JSON.stringify(generatedProduct.options);

        // Prepare transaction operations
        const txOps = [
          db.tx.products[selectedProduct.id].update(updateData)
          ];

          // Add item creation operations
          for (const item of generatedItems) {
            txOps.push(
              db.tx.items[id()].update({
                sku: item.sku,
                option: item.option,
                price: item.price,
                cost: item.cost,
                barcode: item.barcode,
                image: item.image,
                attribute: item.attribute ? JSON.stringify(item.attribute) : null,
                product: selectedProduct.id // Link to the product
              })
            );
          }

          await db.transact(txOps);

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
          locations: {},
          modifiers: {}
        },
        components: {} // consumption data
      }
    } : {}
  );

  useEffect(() => {
    // Always update when selectedProduct changes
    prevSelectedProductRef.current = selectedProduct;

    if (selectedProduct) {
    setTitle(selectedProduct.title || '');
    setCategory(selectedProduct.category || '');
    setStatus(selectedProduct.status || '');
      setSupplier(selectedProduct.supplier || '');

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
    setCategory('');
    setStatus('');
    setSupplier('');
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
                <View style={styles.productHeaderTop}>
                  {selectedProduct?.img ? (
                    <Image source={{uri: selectedProduct.img}} style={styles.productImage} />
                  ) : (
                    <View style={styles.productImagePlaceholder} />
                  )}
                  <View style={styles.productHeaderTexts}>
                    <Text style={styles.productTitle}>{title || 'Untitled Product'}</Text>
                    <Text style={styles.productCategory}>{category || 'No category'}</Text>
                  </View>
                </View>
                {status ? <Text style={styles.productStatus}>Status: {status}</Text> : null}
                {supplier ? <Text style={styles.productSupplier}>Supplier: {supplier}</Text> : null}
              </View>

              {/* Options Table - AI Generated Structured Output */}
              {groups.length > 0 && (
                <View style={styles.optionsSection}>
                  <Text style={styles.sectionTitle}>Options</Text>
                  {groups.map((group, groupIndex) => (
                    <View key={groupIndex} style={styles.optionGroup}>
                      <Text style={styles.optionGroupTitle}>{group.name}</Text>
                      {group.values.map((value, valueIndex) => {
                        const isColorOption = group.name.toLowerCase().includes('color') && value.identifier.startsWith('#');
                        return (
                          <View key={valueIndex} style={styles.optionRow}>
                            <Text style={styles.optionLabel}>{value.label}</Text>
                            {isColorOption ? (
                              <View style={styles.colorContainer}>
                                <View style={[styles.colorCircle, { backgroundColor: value.identifier }]} />
                              </View>
                            ) : (
                              <Text style={styles.optionIdentifier}>{value.identifier}</Text>
                            )}
                          </View>
                        );
                      })}
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
                        <View style={styles.itemStart}>
                          {item.image ? (
                            <Image source={{uri: item.image}} style={styles.itemImage} />
                          ) : (
                            <View style={styles.itemImagePlaceholder} />
                          )}
                          <View style={styles.itemLeft}>
                            <Text style={styles.itemSku}>{String(item.sku || 'No SKU')}</Text>
                            <Text style={styles.itemPrice}>${String(item.price || 0)}</Text>
                          </View>
                        </View>
                        <Text style={styles.itemStock}>{String(totalAvailable)}</Text>
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
  productHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
  },
  productImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
    backgroundColor: '#f3f4f6',
  },
  productHeaderTexts: {
    flex: 1,
  },
  productTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
  },
  productStatus: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  productSupplier: {
    fontSize: 14,
    color: '#6b7280',
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
  colorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  colorCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemsSection: {
    marginTop: 20,
  },
  itemsContainer: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  itemStart: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 15,
  },
  itemImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 15,
    backgroundColor: '#f3f4f6',
  },
  itemInfo: {
    flex: 1,
  },
  itemSku: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  itemOptions: {
    marginBottom: 8,
  },
  itemOption: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  itemAttributes: {
    marginBottom: 8,
  },
  itemAttribute: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  itemStock: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#111827',
  },
  itemMeta: {
    marginTop: 4,
  },
  itemMetaText: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  noItemsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
});
