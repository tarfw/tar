import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { generateAPIUrl } from '../../utils';

type SendMessageHandler = (message: string) => Promise<void>;

interface SpaceTerminalProps {
  onRegisterSendMessage?: (handler: SendMessageHandler | null) => void;
}

export default function SpaceTerminal({ onRegisterSendMessage }: SpaceTerminalProps) {
  const scrollRef = useRef<ScrollView>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        fetch: expoFetch as unknown as typeof globalThis.fetch,
        api: generateAPIUrl('/api/chat'),
      }),
    [],
  );

  const { messages, sendMessage, isLoading, error } = useChat({
    id: 'space-terminal-chat',
    transport,
  });

  const handleSendMessage = useCallback<SendMessageHandler>(
    async message => {
      if (typeof message !== 'string') {
        return;
      }

      const trimmed = message.trim();
      if (!trimmed) {
        return;
      }

      await sendMessage({ text: trimmed });
    },
    [sendMessage],
  );

  useEffect(() => {
    if (!onRegisterSendMessage) {
      return;
    }

    onRegisterSendMessage(handleSendMessage);
    return () => {
      onRegisterSendMessage(null);
    };
  }, [handleSendMessage, onRegisterSendMessage]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }
    scrollRef.current.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.messagesContent}>
        {messages.length === 0 ? (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderTitle}>Space Exploration Assistant</Text>
            <Text style={styles.placeholderText}>Ask about planets, missions, and the cosmos.</Text>
          </View>
        ) : (
          messages.map(message => {
            const text = message.parts
              .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
              .map(part => part.text)
              .join('');

            const isUser = message.role === 'user';

            return (
              <View
                key={message.id}
                style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}
              >
                <Text style={[styles.messageAuthor, isUser ? styles.userAuthor : styles.assistantAuthor]}>
                  {isUser ? 'You' : 'Space'}
                </Text>
                {text ? (
                  <Text style={[styles.messageText, isUser && styles.userMessageText]}>{text}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {isLoading ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.statusText}>Space is responding…</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error.message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: 'white',
  },
  messagesContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  placeholderContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: '#1d4ed8',
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    backgroundColor: '#f3f4f6',
    alignSelf: 'flex-start',
  },
  messageAuthor: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  userAuthor: {
    color: '#bfdbfe',
  },
  assistantAuthor: {
    color: '#1f2937',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#111827',
  },
  userMessageText: {
    color: '#f8fafc',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#2563eb',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    marginTop: 8,
  },
});
