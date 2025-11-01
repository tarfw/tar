import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { id } from '@instantdb/react-native';
import { useNavigation } from 'expo-router';
import Console from '../modals/console';
import {
  SpaceTerminal,
  OrdersTerminal,
  ProductterTerminal,
  ItemsTerminal,
  StoresTerminal,
  FilesTerminal,
} from '../terminals';
import db from '../../db';
import { generateAPIUrl } from '../../utils';






export default function Agents() {
  const navigation = useNavigation();
  const [selectedAgentId, setSelectedAgentId] = useState('space');
  const [currentPromo, setCurrentPromo] = useState<{ text: string; url: string } | null>(null);
  const [spaceSendMessage, setSpaceSendMessage] = useState<((message: string) => Promise<void>) | null>(null);
  const [productSendMessage, setProductSendMessage] = useState<((message: string) => Promise<void>) | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const INFOBAR_HEIGHT = 60;
  const INFOBAR_PROMOS = [
    { text: '🛍️ Exclusive Fashion Deals', url: 'https://example.com/fashion' },
    { text: '💻 Tech Gadgets on Sale', url: 'https://example.com/tech' },
    { text: '🏠 Home Decor Offers', url: 'https://example.com/home' },
    { text: '🏋️ Fitness Gear Discounts', url: 'https://example.com/fitness' },
    { text: '✈️ Travel Packages Deals', url: 'https://example.com/travel' },
  ];

  // Fetch data for each agent
  const { data: productsData } = db.useQuery({
    products: {
      $: {
        order: { title: 'asc' },
        limit: 50
      }
    }
  });
  const { data: ordersData, isLoading: ordersLoading, error: ordersError } = db.useQuery({
    orders: {
      $: {
        limit: 50
      }
    }
  });
  const { data: itemsData } = db.useQuery({
    items: {
      $: {
        order: { sku: 'asc' },
        limit: 50
      }
    }
  });
  const { data: storesData } = db.useQuery({
    stores: {
      $: {
        order: { name: 'asc' },
        limit: 50
      }
    }
  });
  const { data: filesData } = db.useQuery({
    $files: {
      $: {
        order: { path: 'asc' },
        limit: 50
      }
    }
  });
  const { data: locationsData, isLoading: locationsLoading, error: locationsError } = db.useQuery({
    locations: {
      $: {
        limit: 50
      }
    }
  });
  const { data: customersData, isLoading: customersLoading, error: customersError } = db.useQuery({
    customers: {
      $: {
        limit: 50
      }
    }
  });
  const registerSpaceSendHandler = useCallback(
    (handler: ((message: string) => Promise<void>) | null) => {
      setSpaceSendMessage(() => handler);
    },
    [],
  );

  const agents = [
    {
      id: 'space',
      name: 'Space',
      icon: '🌌',
      data: ['Space 1', 'Space 2', 'Space 3', 'Space 4'],
    },
    {
      id: 'orders',
      name: 'Orders',
      icon: '🎈',
      data: ordersData?.orders?.map(o => o.id) || (ordersError ? ['Error loading orders'] : ordersLoading ? ['Loading orders...'] : ['No orders found']),
    },
    {
      id: 'products',
      name: 'Products',
      icon: '🛍️',
      data: productsData?.products?.map(p => p.title || 'Unnamed Product') || [],
      fullData: productsData?.products || [],
    },
    {
      id: 'items',
      name: 'Items',
      icon: '📦',
      data: itemsData?.items?.map(i => i.sku || 'Unnamed Item') || [],
    },
    {
      id: 'stores',
      name: 'Stores',
      icon: '🌟',
      data: storesData?.stores?.map(s => s.name || 'Unnamed Store') || [],
    },
    {
      id: 'files',
      name: 'Files',
      icon: '📁',
      data: filesData?.$files?.map(f => f.path) || [],
    },
    {
      id: 'locations',
      name: 'Locations',
      icon: '🌍',
      data: locationsData?.locations?.map(l => l.name || 'Unnamed Location') || (locationsError ? ['Error loading locations'] : locationsLoading ? ['Loading locations...'] : ['No locations found']),
    },
    {
      id: 'customers',
      name: 'Customers',
      icon: '@',
      data: customersData?.customers?.map(c => c.name || c.email || 'Unnamed Customer') || (customersError ? ['Error loading customers'] : customersLoading ? ['Loading customers...'] : ['No customers found']),
    },
  ];

  const terminalComponents = useMemo(
    () => ({
      orders: OrdersTerminal,
      products: ProductterTerminal,
      items: ItemsTerminal,
      stores: StoresTerminal,
      files: FilesTerminal,
    }),
    [],
  );

  useEffect(() => {
    if (selectedAgentId === 'space') {
      const changePromo = () => {
        const randomIndex = Math.floor(Math.random() * INFOBAR_PROMOS.length);
        setCurrentPromo(INFOBAR_PROMOS[randomIndex]);
      };
      changePromo(); // Set initial
      const interval = setInterval(changePromo, 5000);
      return () => clearInterval(interval);
    } else {
      setCurrentPromo(null);
    }
  }, [selectedAgentId]);

  const handleConsoleSend = useCallback(
    async (message: string) => {
      if (typeof message !== 'string') {
        return;
      }

      if (selectedAgentId !== 'space' || !spaceSendMessage) {
        return;
      }

      await spaceSendMessage(message);
    },
    [selectedAgentId, spaceSendMessage],
  );

  const handleProductAISend = useCallback(async (message: string) => {
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
        existingProduct: selectedProduct ? {
        title: selectedProduct.title,
        category: selectedProduct.category,
        img: selectedProduct.img,
        status: selectedProduct.status,
        supplier: selectedProduct.supplier,
        options: selectedProduct.options
        } : null
        }),
      });

      console.log('API response status:', response.status, response.ok);

      if (response.ok) {
  const data = await response.json();
      console.log('API response received:', data);

        let generatedProduct = data.product;
        let generatedItems = data.items || [];

        // If structured product is not available, try to parse from text
        if (!generatedProduct && data.text) {
          try {
          // The AI should now output clean JSON, so try direct parsing first
          let parsed;
          try {
          parsed = JSON.parse(data.text.trim());
          } catch {
          console.log('Direct JSON parse failed, trying fallbacks. Raw text:', data.text);

            // Try to handle escaped JSON string from older AI responses
          try {
            let text = data.text;
          // If it starts and ends with quotes, remove them
          if (text.startsWith('"') && text.endsWith('"')) {
            text = text.slice(1, -1);
          }
          // Unescape quotes
          text = text.replace(/"/g, '"');
          parsed = JSON.parse(text);
          } catch (e1) {
          console.log('Escaped JSON parse failed:', e1);
            // Try to extract JSON-like content as last resort
          try {
                const jsonLike = data.text.match(/\{.*\}/s);
            if (jsonLike) {
              parsed = JSON.parse(jsonLike[0]);
          } else {
            throw new Error('No valid JSON found in response');
          }
          } catch (e2) {
          console.log('Final parsing attempt failed:', e2);
          throw new Error('No valid JSON found in response');
          }
          }
          }

              // Validate and clean the parsed product data
              if (parsed.title || parsed.category || parsed.options) {
                generatedProduct = {
                  title: parsed.title || 'New Product',
                  category: parsed.category || parsed.type || 'Product', // Handle legacy 'type' field
                  img: parsed.img || null,
                  status: parsed.status || null,
                supplier: parsed.supplier || null,
                options: parsed.options || null
                };
              }
            } catch (e) {
              console.error('Failed to parse product from text:', e);
            }
          }

        if (generatedProduct) {
                let productId: string;

          if (selectedProduct) {
            // Update existing product
            productId = selectedProduct.id;
            const updateData: any = {};
            if (generatedProduct.title !== undefined) updateData.title = generatedProduct.title;
          if (generatedProduct.category !== undefined) updateData.category = generatedProduct.category;
            if (generatedProduct.status !== undefined) updateData.status = generatedProduct.status;
                  if (generatedProduct.supplier !== undefined) updateData.supplier = generatedProduct.supplier;
          if (generatedProduct.options !== undefined) updateData.options = JSON.stringify(generatedProduct.options);

            await db.transact(
                    db.tx.products[productId].update(updateData)
          );

        // Update the local state immediately to reflect changes
        setSelectedProduct({
          ...selectedProduct,
            ...generatedProduct,
              options: generatedProduct.options ? JSON.stringify(generatedProduct.options) : selectedProduct.options
            });
          } else {
            // Create new product
            productId = id();
            const newProductData: any = {
              id: productId,
            title: generatedProduct.title || 'New Product',
            category: generatedProduct.category || 'Product',
                  status: generatedProduct.status || null,
              supplier: generatedProduct.supplier || null,
                  options: generatedProduct.options ? JSON.stringify(generatedProduct.options) : null,
                    img: generatedProduct.img || null,
                  };

                  await db.transact(
                    db.tx.products[productId].update(newProductData)
                  );

                  // Set as selected product
                  setSelectedProduct(newProductData);
          }

          // Create items if any were generated
          if (generatedItems.length > 0) {
            const itemTxOps = generatedItems.map((item: any) => {
              const itemId = id();
              return db.tx.items[itemId].update({
                id: itemId,
                sku: item.sku,
                option: item.option,
                price: item.price,
                cost: item.cost,
                barcode: item.barcode,
                image: item.image,
                attribute: item.attribute ? JSON.stringify(item.attribute) : null,
                product: productId // Link to the product
              });
            });

            await db.transact(itemTxOps);
            console.log(`Created ${generatedItems.length} items for product ${productId}`);
          }
        } else {
          console.error('No product data found in response');
        }

  } else {
  const errorText = await response.text();
  console.error('Failed to generate product data. Status:', response.status, 'Response:', errorText);
  }
  } catch (error) {
  console.error('AI generation error:', error);
  }
  }, [selectedProduct]);

  const handleItemSelect = useCallback((item: any) => {
    setSelectedProduct(item);
  }, []);

  const handleProductRegisterSendMessage = useCallback((handler: ((message: string) => Promise<void>) | null) => {
    setProductSendMessage(handler);
  }, []);

  const handleExpandedChange = useCallback((expanded: boolean) => {
    navigation.setOptions({
      tabBarStyle: expanded ? { display: 'none' } : undefined,
    });
  }, [navigation]);

  const consoleSendHandler = useCallback(async (message: string) => {
    if (!message || typeof message !== 'string') return;

    if (selectedAgentId === 'space' && handleConsoleSend) {
      await handleConsoleSend(message);
    } else if (selectedAgentId === 'products') {
      await handleProductAISend(message);
    }
  }, [selectedAgentId, handleConsoleSend, handleProductAISend]);

  return (
    <View style={styles.container}>
      {selectedAgentId === 'space' && currentPromo ? (
        <TouchableOpacity
          style={styles.infobar}
          onPress={() => Linking.openURL(currentPromo.url)}
          activeOpacity={0.8}
        >
          <Text style={styles.infobarText}>{currentPromo.text}</Text>
          <MaterialIcons name="chevron-right" size={20} color="white" />
        </TouchableOpacity>
      ) : null}

      <View
        style={[
          styles.content,
          {
            paddingTop: selectedAgentId === 'space' && currentPromo ? INFOBAR_HEIGHT + 16 : 16,
          },
        ]}
      >
        {selectedAgentId === 'space' ? (
          <SpaceTerminal onRegisterSendMessage={registerSpaceSendHandler} />
        ) : (
          (() => {
            const TerminalComponent = terminalComponents[selectedAgentId as keyof typeof terminalComponents];
            if (selectedAgentId === 'products') {
              return <ProductterTerminal
                selectedProduct={selectedProduct}
                onProductChange={setSelectedProduct}
                onRegisterSendMessage={handleProductRegisterSendMessage}
              />;
            }
            return TerminalComponent ? <TerminalComponent selectedProduct={selectedProduct} onProductChange={setSelectedProduct} /> : null;
          })()
        )}
      </View>






      <Console
        selectedAgentId={selectedAgentId}
        agents={agents}
        onAgentSelect={setSelectedAgentId}
        onSendMessage={consoleSendHandler}
        onItemSelect={handleItemSelect}
        placeholder={selectedAgentId === 'products' ? 'Describe product changes with AI...' : undefined}
        onExpandedChange={handleExpandedChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    flex: 1,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chatMessage: {
    paddingVertical: 4,
  },
  chatText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#1d4ed8',
  },
  assistantText: {
    color: '#111827',
  },
  chatDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginTop: 8,
  },
  infobar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    padding: 12,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infobarText: {
    fontSize: 14,
    color: 'black',
    fontWeight: '600',
    flex: 1,
  },

});
