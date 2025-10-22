import React, { useEffect, useState, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  Keyboard,
  Platform,
} from 'react-native';
import type { KeyboardEvent } from 'react-native';

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

export default function SpaceTerminal({
  messages,
  error,
  sendMessage,
}: {
  messages: any[];
  error: any;
  sendMessage: (message: { text: string }) => void;
}) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const shouldAutoScrollRef = useRef(true);
  const lastLoggedMessageRef = useRef<string | null>(null);

  const keyboardInset = Platform.OS === 'android' ? keyboardHeight : 0;

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
    shouldAutoScrollRef.current = true;
  }, []);

  useEffect(() => {
    if (!scrollViewRef.current) return;
    if (!shouldAutoScrollRef.current) return;
    if (!messages || !Array.isArray(messages)) return;
    scrollViewRef.current.scrollToEnd({ animated: true });
  }, [messages]);

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

  return (
    <View
      style={[
        styles.content,
        {
          paddingBottom: keyboardInset + 80,
        },
      ]}
    >
      {error ? (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
