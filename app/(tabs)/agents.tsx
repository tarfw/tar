import React, { useEffect, useState, useRef } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import type { KeyboardEvent } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { generateAPIUrl } from '../../utils';
import Console from '../modals/console';
import {
  SpaceTerminal,
  SalesTerminal,
  OrdersTerminal,
  ProductsTerminal,
  ItemsTerminal,
  StoresTerminal,
  FilesTerminal,
} from '../terminals';




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

  const agents = [
    {
      id: 'space',
      name: 'Space',
      icon: '🌌',
      data: ['Explore planets', 'Black hole facts', 'Mars mission updates', 'Space exploration history'],
    },
    {
      id: 'sales',
      name: 'Sales',
      icon: '📈',
      data: ['Revenue summary', 'Top opportunities', 'Pipeline at risk', 'Regional leaderboard'],
    },
    {
      id: 'orders',
      name: 'Orders',
      icon: '🛒',
      data: ['Order #4832', 'Order #5921', 'Order #6103', 'Order #7018'],
    },
    {
      id: 'products',
      name: 'Products',
      icon: '🛍️',
      data: ['Product Alpha', 'Product Sigma', 'Product Echo', 'Product Delta'],
    },
    {
      id: 'items',
      name: 'Items',
      icon: '📦',
      data: ['Item K21-B', 'Item R04-C', 'Item Q88', 'Item L10'],
    },
    {
      id: 'stores',
      name: 'Stores',
      icon: '🎈',
      data: ['Store Downtown', 'Store Uptown', 'Store Westside', 'Store Riverside'],
    },
    {
      id: 'files',
      name: 'Files',
      icon: '📁',
      data: ['Q1 Report.pdf', 'SupplierContract.docx', 'OnboardingChecklist.md', 'BrandGuidelines.pptx'],
    },
  ];

  const terminalComponents = {
  space: SpaceTerminal,
  sales: SalesTerminal,
  orders: OrdersTerminal,
  products: ProductsTerminal,
  items: ItemsTerminal,
  stores: StoresTerminal,
  files: FilesTerminal,
  };

  const { messages, error, sendMessage } = useChat({
    initialMessages: [],
    transport: new DefaultChatTransport({
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      api: generateAPIUrl('/api/chat'),
    }),
    onError: error => console.error(error, 'ERROR'),
  });



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
        {React.createElement(
          terminalComponents[selectedAgentId],
          selectedAgentId === 'space' ? { messages, error, sendMessage } : {}
        )}
      </View>






      <Console
        selectedAgentId={selectedAgentId}
        agents={agents}
        onAgentSelect={setSelectedAgentId}
        onSendMessage={selectedAgentId === 'space' ? (message) => sendMessage({ text: message }) : undefined}
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
