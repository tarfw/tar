import { View, Text, TextInput, ScrollView, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useState, useRef, useEffect } from 'react';
import { tar } from '@/lib/tar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ChatAutocomplete } from '@/components/ChatAutocomplete';
import { ActionCard } from '@/components/ActionCard';
import { useLLM, models } from 'react-native-executorch';
import { isHammerCached, isLfmCached } from '@/lib/hammer';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeCard, setActiveCard] = useState<Memory | null>(null);
  const [chatMode, setChatMode] = useState<'cloud' | 'hammer' | 'lfm'>('cloud');
  const [isHammerCachedState, setIsHammerCachedState] = useState(false);
  const [isLfmCachedState, setIsLfmCachedState] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, activeCard]);

  // Check which models are cached on mount and when toggling mode
  useEffect(() => {
    isHammerCached().then(setIsHammerCachedState);
    isLfmCached().then(setIsLfmCachedState);
  }, [chatMode]);

  // Load Hammer model only when selected
  const hammerLlm = useLLM({
    model: models.llm.hammer2_1_0_5b(),
    preventLoad: chatMode !== 'hammer',
  });

  // Load LFM 2.5 model only when selected
  const lfmLlm = useLLM({
    model: models.llm.lfm2_5_1_2b_instruct(),
    preventLoad: chatMode !== 'lfm',
  });

  // Helper variables for the active local model
  const activeLlm = chatMode === 'hammer' ? hammerLlm : chatMode === 'lfm' ? lfmLlm : null;
  const isActiveCached = chatMode === 'hammer' ? isHammerCachedState : chatMode === 'lfm' ? isLfmCachedState : false;
  const activeModelName = chatMode === 'hammer' ? 'Hammer 2.1 (0.5B)' : chatMode === 'lfm' ? 'LFM 2.5 (1.2B)' : '';

  // Fetch action memories when user types
  useEffect(() => {
    if (input.length < 2) {
      setMemories([]);
      setShowAutocomplete(false);
      return;
    }

    const timer = setTimeout(() => {
      tar.tool('search', { query: input, limit: 5 })
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
      if (chatMode !== 'cloud') {
        if (!isActiveCached) {
          throw new Error(`${activeModelName} model is not downloaded. Please download it from Settings.`);
        }
        if (!activeLlm || !activeLlm.isReady) {
          throw new Error(`${activeModelName} model is still loading...`);
        }
        const systemPrompt = {
          role: 'system' as const,
          content: `You are a helpful local assistant powered by the ${activeModelName} model.`,
        };
        const chatHistory = [
          systemPrompt,
          ...messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
          { role: 'user' as const, content: text },
        ];
        const responseText = await activeLlm.generate(chatHistory);
        setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
      } else {
        const result = await tar.chat('default', text);
        const reply = result?.reply || result?.message || 'I received your message.';
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      }
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
      const result = await tar.chat('default', `Execute ${activeCard.intent}: ${JSON.stringify(values)}`);
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
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => router.back()} style={{ paddingRight: 4 }}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Chat</Text>
          </View>
          
          <View style={[styles.selectorContainer, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Pressable
              style={[styles.selectorButton, chatMode === 'cloud' && { backgroundColor: theme.primary }]}
              onPress={() => setChatMode('cloud')}>
              <Text style={[styles.selectorText, { color: chatMode === 'cloud' ? '#fff' : theme.textSecondary }]}>Cloud</Text>
            </Pressable>
            <Pressable
              style={[styles.selectorButton, chatMode === 'hammer' && { backgroundColor: theme.primary }]}
              onPress={() => setChatMode('hammer')}>
              <Text style={[styles.selectorText, { color: chatMode === 'hammer' ? '#fff' : theme.textSecondary }]}>Hammer</Text>
            </Pressable>
            <Pressable
              style={[styles.selectorButton, chatMode === 'lfm' && { backgroundColor: theme.primary }]}
              onPress={() => setChatMode('lfm')}>
              <Text style={[styles.selectorText, { color: chatMode === 'lfm' ? '#fff' : theme.textSecondary }]}>LFM 2.5</Text>
            </Pressable>
          </View>
        </View>

        {chatMode !== 'cloud' && (
          <View style={styles.statusBanner}>
            <Ionicons
              name={activeLlm?.isReady ? 'checkmark-circle' : 'sync'}
              size={14}
              color={activeLlm?.isReady ? '#34C759' : theme.primary}
            />
            <Text style={[styles.statusText, { color: theme.textSecondary }]}>
              {!isActiveCached
                ? `${activeModelName} not downloaded. Go to Settings.`
                : !activeLlm?.isReady
                  ? `Loading ${activeModelName}...`
                  : `${activeModelName} Ready`}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}>
        {messages.length === 0 && !activeCard && (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>What can I help with?</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              {chatMode !== 'cloud'
                ? `Local chat is active. You are chatting directly with the on-device ${activeModelName} model.`
                : 'I can create workspaces, manage orders, track inventory, and more.'}
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
            <Text style={[styles.bubbleText, { color: activeLlm && activeLlm.response ? theme.text : theme.textMuted }]}>
              {activeLlm && activeLlm.response ? activeLlm.response : 'Thinking...'}
            </Text>
          </View>
        )}
      </ScrollView>

      {showAutocomplete && memories.length > 0 && (
        <ChatAutocomplete memories={memories} onSelect={handleMemorySelect} />
      )}

      <View style={[styles.inputBar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        {messages.length > 0 && (
          <Pressable
            style={[styles.clearButton, { backgroundColor: theme.backgroundElement }]}
            onPress={() => setMessages([])}>
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
          </Pressable>
        )}
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          value={input}
          onChangeText={setInput}
          placeholder={
            chatMode !== 'cloud'
              ? !isActiveCached
                ? `Download ${activeModelName} in settings...`
                : !activeLlm?.isReady
                  ? `Loading ${activeModelName}...`
                  : `Chat locally with ${chatMode === 'hammer' ? 'Hammer' : 'LFM'}...`
              : 'Type a message...'
          }
          placeholderTextColor={theme.textMuted}
          onSubmitEditing={sendMessage}
          editable={!loading && (chatMode === 'cloud' || (isActiveCached && activeLlm?.isReady))}
        />
        <Pressable
          style={[
            styles.sendButton,
            {
              backgroundColor:
                input.trim() && (chatMode === 'cloud' || (isActiveCached && activeLlm?.isReady))
                  ? theme.primary
                  : theme.backgroundElement,
            },
          ]}
          onPress={sendMessage}
          disabled={!input.trim() || loading || (chatMode !== 'cloud' && (!isActiveCached || !activeLlm?.isReady))}>
          <Ionicons
            name="send"
            size={18}
            color={
              input.trim() && (chatMode === 'cloud' || (isActiveCached && activeLlm?.isReady))
                ? '#fff'
                : theme.textMuted
            }
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 32, fontWeight: '800' },
  selectorContainer: { flexDirection: 'row', borderRadius: 20, borderWidth: 1, padding: 2, alignItems: 'center' },
  selectorButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18 },
  selectorText: { fontSize: 13, fontWeight: '600' },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 4 },
  statusText: { fontSize: 12, fontWeight: '500' },
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
  clearButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
