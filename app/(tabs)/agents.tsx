import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Console from '../modals/console';
import {
  SpaceTerminal,
  OrdersTerminal,
  ProductsTerminal,
  ItemsTerminal,
  StoresTerminal,
  FilesTerminal,
} from '../terminals';
import db from '../../db';




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
      products: ProductsTerminal,
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

  const handleItemSelect = useCallback((item: any) => {
    setSelectedProduct(item);
  }, []);

  const consoleSendHandler = selectedAgentId === 'space' && spaceSendMessage ? handleConsoleSend : undefined;

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
            if (selectedAgentId === 'products') {
              return <ProductsTerminal selectedProduct={selectedProduct} />;
            }
            const TerminalComponent = terminalComponents[selectedAgentId as keyof typeof terminalComponents];
            return TerminalComponent ? <TerminalComponent /> : null;
          })()
        )}
      </View>






      <Console
        selectedAgentId={selectedAgentId}
        agents={agents}
        onAgentSelect={setSelectedAgentId}
        onSendMessage={consoleSendHandler}
        onItemSelect={handleItemSelect}
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
