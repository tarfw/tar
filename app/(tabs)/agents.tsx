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
import Console from '../../modals/console';

type MessagePart = {
  type?: string;
  text?: string;
  state?: string;
  [key: string]: unknown;
};

const extractMessageParts = (message: unknown): MessagePart[] => {
  if (Array.isArray((message as { parts?: unknown })?.parts)) {
    return [...((message as { parts: MessagePart[] }).parts)];
  }

  const content = (message as { content?: unknown })?.content;

  if (Array.isArray(content)) {
    return content as MessagePart[];
  }

  if (typeof content === 'string' && content.trim()) {
    return [{ type: 'text', text: content }];
  }

  if (typeof (message as { text?: unknown })?.text === 'string') {
    return [{ type: 'text', text: (message as { text: string }).text }];
  }

  return [];
};

const extractMessageText = (message: unknown) => {
  const parts = extractMessageParts(message);

  const textFromParts = parts
    .map(part => (part?.type === 'text' && typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();

  if (textFromParts) {
    return textFromParts;
  }

  const content = (message as { content?: unknown })?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (typeof (message as { text?: unknown })?.text === 'string') {
    return (message as { text: string }).text;
  }

  return '';
};


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
  
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const shouldAutoScrollRef = useRef(true);
  const lastLoggedMessageRef = useRef<string | null>(null);

  const keyboardInset = Platform.OS === 'android' ? keyboardHeight : 0;

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

  const { messages, error, sendMessage } = useChat({
    initialMessages: [],
    transport: new DefaultChatTransport({
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      api: generateAPIUrl('/api/chat'),
    }),
    onError: error => console.error(error, 'ERROR'),
  });

  const getAssistantPreview = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return '';
    const words = trimmed.split(/\s+/);
    if (words.length <= 20) {
      return trimmed;
    }
    return `${words.slice(0, 20).join(' ')}…`;
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const handleShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    };

    const handleHide = () => {
      setKeyboardHeight(0);
    };

    const showSubscription = Keyboard.addListener(showEvent, handleShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (selectedAgentId === 'space') {
      shouldAutoScrollRef.current = true;
    }
  }, [selectedAgentId]);

  useEffect(() => {
    if (selectedAgentId !== 'space') return;
    if (!scrollViewRef.current) return;
    if (!shouldAutoScrollRef.current) return;
    if (!messages || !Array.isArray(messages)) return;
    scrollViewRef.current.scrollToEnd({ animated: true });
  }, [messages, selectedAgentId]);

  useEffect(() => {
    if (!messages || !Array.isArray(messages) || messages.length === 0) return;
    const lastAssistant = [...messages].reverse().find(message => message.role === 'assistant');
    if (!lastAssistant) return;

    const lastAssistantParts = extractMessageParts(lastAssistant);
    const hasStreamingPart = lastAssistantParts.some(part => part?.state === 'streaming');
    if (hasStreamingPart) {
      return;
    }

    const text = extractMessageText(lastAssistant);

    if (!text) {
      return;
    }

    const signature = `${lastAssistant.id}:${text}`;
    if (lastLoggedMessageRef.current === signature) {
      return;
    }

    lastLoggedMessageRef.current = signature;
    console.log('AI Response:', getAssistantPreview(text));
  }, [messages]);

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? INFOBAR_HEIGHT : 0}
    >
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
            paddingBottom: keyboardInset + 80,
          },
        ]}
      >
        {selectedAgentId === 'space' ? (
          error ? (
            <Text>{error.message}</Text>
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={styles.chatScroll}
              contentContainerStyle={styles.chatContent}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => {
                if (shouldAutoScrollRef.current) {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }
              }}
              onScroll={event => {
                const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
                const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
                shouldAutoScrollRef.current = distanceFromBottom < 48;
              }}
              scrollEventThrottle={16}
            >
              {(messages || []).map((message, index) => {
                const timestamp = typeof message.createdAt === 'number'
                  ? message.createdAt
                  : typeof message.createdAt === 'string'
                    ? new Date(message.createdAt).getTime()
                    : Date.now() + index;
                const key = `${message.id}-${timestamp}-${index}`;
                const isUser = message.role === 'user';
                const messageText = extractMessageText(message);
                const displayText = isUser
                  ? messageText
                  : getAssistantPreview(messageText);

                if (!displayText) return null;

                return (
                  <View key={key} style={styles.chatMessage}>
                    <Text style={[styles.chatText, isUser ? styles.userText : styles.assistantText]}>
                      {displayText}
                    </Text>
                    {index < messages.length - 1 && <View style={styles.chatDivider} />}
                  </View>
                );
              })}
            </ScrollView>
          )
        ) : (
          <Text>Agents Screen</Text>
        )}
      </View>






      <Console
        selectedAgentId={selectedAgentId}
        agents={agents}
        onAgentSelect={setSelectedAgentId}
        onSendMessage={selectedAgentId === 'space' ? (message) => sendMessage({ text: message }) : undefined}
      />
    </KeyboardAvoidingView>
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
    backgroundColor: 'black',
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
