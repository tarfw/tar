import { View, Text, TextInput, ScrollView, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useState, useRef, useEffect } from 'react';
import { tarflue } from '@/lib/tarflue';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ChatAutocomplete } from '@/components/ChatAutocomplete';
import { ActionCard } from '@/components/ActionCard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Memory {
  id: string;
  text: string;
  intent: string;
  workflow?: string;
  slots: Array<{ key: string; label: string; type: string; value: any }>;
}

export default function ChatScreen() {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeCard, setActiveCard] = useState<Memory | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, activeCard]);

  // Fetch action memories when user types
  useEffect(() => {
    if (input.length < 2) {
      setMemories([]);
      setShowAutocomplete(false);
      return;
    }

    const timer = setTimeout(() => {
      tarflue.tools.search({ query: input, limit: 5 })
        .then((result: any) => {
          const actionMemories = (result.rows || [])
            .filter((r: any) => {
              const meta = typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta;
              return meta?.type === 'action_memory';
            })
            .map((r: any) => {
              const meta = typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta;
              return {
                id: r.id,
                text: r.text || '',
                intent: meta.intent || '',
                workflow: meta.workflow || '',
                slots: meta.slots || [],
              };
            });
          setMemories(actionMemories);
          setShowAutocomplete(actionMemories.length > 0);
        })
        .catch(() => {});
    }, 300);

    return () => clearTimeout(timer);
  }, [input]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setShowAutocomplete(false);
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const result = await tarflue.agents.chat(text);
      const reply = result?.reply || result?.message || 'I received your message.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleMemorySelect = (memory: Memory) => {
    setShowAutocomplete(false);
    setActiveCard(memory);
  };

  const handleCardExecute = async (values: Record<string, any>) => {
    if (!activeCard) return;
    setActiveCard(null);
    setLoading(true);

    try {
      // Execute the workflow with the card values
      const result = await tarflue.agents.chat(`Execute ${activeCard.intent}: ${JSON.stringify(values)}`);
      const reply = result?.reply || result?.message || 'Action completed.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Chat</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}>
        {messages.length === 0 && !activeCard && (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>What can I help with?</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              I can create workspaces, manage orders, track inventory, and more.
            </Text>
          </View>
        )}
        {messages.map((msg, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              msg.role === 'user'
                ? [styles.userBubble, { backgroundColor: theme.primary }]
                : [styles.assistantBubble, { backgroundColor: theme.backgroundElement, borderColor: theme.border }],
            ]}>
            <Text style={[styles.bubbleText, { color: msg.role === 'user' ? '#fff' : theme.text }]}>
              {msg.content}
            </Text>
          </View>
        ))}
        {activeCard && (
          <ActionCard
            memory={activeCard}
            onExecute={handleCardExecute}
            onCancel={() => setActiveCard(null)}
          />
        )}
        {loading && (
          <View style={[styles.bubble, styles.assistantBubble, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Text style={[styles.bubbleText, { color: theme.textMuted }]}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      {showAutocomplete && memories.length > 0 && (
        <ChatAutocomplete memories={memories} onSelect={handleMemorySelect} />
      )}

      <View style={[styles.inputBar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor={theme.textMuted}
          onSubmitEditing={sendMessage}
          editable={!loading}
        />
        <Pressable
          style={[styles.sendButton, { backgroundColor: input.trim() ? theme.primary : theme.backgroundElement }]}
          onPress={sendMessage}
          disabled={!input.trim() || loading}>
          <Ionicons name="send" size={18} color={input.trim() ? '#fff' : theme.textMuted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 32, fontWeight: '800' },
  messages: { flex: 1, paddingHorizontal: 16 },
  messagesContent: { paddingBottom: 16 },
  empty: { alignItems: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  inputBar: { flexDirection: 'row', padding: 12, borderTopWidth: 1, alignItems: 'center', gap: 8 },
  input: { flex: 1, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, fontSize: 15 },
  sendButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
