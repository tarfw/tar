import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { id } from '@instantdb/react-native';
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




const INFOBAR_HEIGHT = 60;
const INFOBAR_PROMOS = [
  { text: 'Discover the wonders of the universe 🌌', url: 'https://www.nasa.gov/universe' },
  { text: 'Explore distant planets and galaxies 🚀', url: 'https://www.nasa.gov/planetary-science' },
  { text: 'Learn about black holes and cosmic mysteries 🕳️', url: 'https://www.nasa.gov/universe/black-holes' },
  { text: 'Stay updated on space missions and discoveries 🛰️', url: 'https://www.nasa.gov/missions' },
  { text: 'Journey through space exploration history 📜', url: 'https://www.nasa.gov/history' },
];

export default function Agents() {
  const [selectedAgentId, setSelectedAgentId] = useState('space');
  const [currentPromo, setCurrentPromo] = useState<{ text: string; url: string } | null>(null);
  const [spaceSendMessage, setSpaceSendMessage] = useState<((message: string) => Promise<void>) | null>(null);
  const [productSendMessage, setProductSendMessage] = useState<((message: string) => Promise<void>) | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

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
      icon: '🛒',
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
      icon: '🎈',
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
      icon: '🏢',
      data: locationsData?.locations?.map(l => l.name || 'Unnamed Location') || (locationsError ? ['Error loading locations'] : locationsLoading ? ['Loading locations...'] : ['No locations found']),
    },
    {
      id: 'customers',
      name: 'Customers',
      icon: '👥',
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
          type: selectedProduct.type,
            img: selectedProduct.img,
            notes: selectedProduct.notes,
            options: selectedProduct.options
          } : null
        }),
      });

      console.log('API response status:', response.status, response.ok);

      if (response.ok) {
  const data = await response.json();
      console.log('API response received:', data);

        let generatedProduct = data.product;

        // If structured product is not available, try to parse from text
  if (!generatedProduct && data.text) {
        try {
        // Extract JSON from the text response
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

              // Handle options format conversion if needed
  if (parsed.options && Array.isArray(parsed.options)) {
              // Convert array format [["Size", "small"]] to object format {"Size": [["Small", "S"]]}
              const optionsObj: Record<string, [string, string][]> = {};
                parsed.options.forEach(([group, value]: [string, string]) => {
                if (!optionsObj[group]) optionsObj[group] = [];
                // Try to create proper identifiers
                  let identifier = value;
                  if (group.toLowerCase().includes('color') && !value.startsWith('#')) {
                  // Generate basic hex codes for common colors
                  const colorMap: Record<string, string> = {
                      'red': '#FF0000',
                      'blue': '#0000FF',
                      'green': '#00FF00',
                    'yellow': '#FFFF00',
                    'black': '#000000',
                    'white': '#FFFFFF',
                      'gray': '#808080',
                      'grey': '#808080',
                      'brown': '#964B00'
                    };
                    identifier = colorMap[value.toLowerCase()] || '#CCCCCC';
                  } else if (group.toLowerCase().includes('size')) {
                    // Standardize size identifiers
                  const sizeMap: Record<string, string> = {
                    'small': 'S',
                    'medium': 'M',
                      'large': 'L',
                      'extra large': 'XL',
                      'extra small': 'XS'
                    };
                    identifier = sizeMap[value.toLowerCase()] || value.toUpperCase().substring(0, 2);
                  }
                  optionsObj[group].push([value, identifier]);
                });
                parsed.options = optionsObj;
              }

              generatedProduct = parsed;
  }
          } catch (e) {
            console.error('Failed to parse product from text:', e);
          }
        }

        if (generatedProduct) {
  if (selectedProduct) {
        // Update existing product
          const updateData: any = {};
          if (generatedProduct.title !== undefined) updateData.title = generatedProduct.title;
          if (generatedProduct.type !== undefined) updateData.type = generatedProduct.type;
          if (generatedProduct.notes !== undefined) updateData.notes = generatedProduct.notes;
          if (generatedProduct.options !== undefined) updateData.options = JSON.stringify(generatedProduct.options);

  await db.transact(
          db.tx.products[selectedProduct.id].update(updateData)
            );

  // Update the local state immediately to reflect changes
          setSelectedProduct({
          ...selectedProduct,
            ...generatedProduct,
            options: generatedProduct.options ? JSON.stringify(generatedProduct.options) : selectedProduct.options
            });
          } else {
        // Create new product
          const newProductData: any = {
        id: id(),
  title: generatedProduct.title || 'New Product',
      type: generatedProduct.type || 'Product',
        notes: generatedProduct.notes || '',
        options: generatedProduct.options ? JSON.stringify(generatedProduct.options) : null,
      img: generatedProduct.img || null,
    };

    await db.transact(
  db.tx.products[newProductData.id].update(newProductData)
  );

  // Set as selected product
  setSelectedProduct(newProductData);
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
    backgroundColor: '#1e3a8a',
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
    color: 'white',
    fontWeight: '600',
    flex: 1,
  },

});
