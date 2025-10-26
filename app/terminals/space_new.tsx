import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { generateAPIUrl } from '../../utils';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type SendMessageHandler = (message: string) => Promise<void>;

interface SpaceTerminalProps {
  onRegisterSendMessage?: (handler: SendMessageHandler | null) => void;
}

export default function SpaceTerminal({ onRegisterSendMessage }: SpaceTerminalProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendMessage = useCallback<SendMessageHandler>(
    async message => {
      if (typeof message !== 'string') {
        return;
      }

      const trimmed = message.trim();
      if (!trimmed) {
        return;
      }

      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: trimmed,
      };

      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(generateAPIUrl('/api/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [userMessage] }),
        });

        if (response.ok) {
          const data = await response.json();
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.text,
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          setError('Failed to get response');
        }
      } catch (err) {
        setError('Network error');
      } finally {
        setIsLoading(false);
      }
    },
    [],
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
            <Text style={styles.placeholderTitle}>Spaces</Text>
          </View>
        ) : (
          messages.map(message => {
            const isUser = message.role === 'user';

            return (
              <View
                key={message.id}
                style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}
              >
                <Text style={[styles.messageAuthor, isUser ? styles.userAuthor : styles.assistantAuthor]}>
                  {isUser ? 'You' : 'Space'}
                </Text>
                <Text style={[styles.messageText, isUser && styles.userMessageText]}>{message.content}</Text>
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

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
