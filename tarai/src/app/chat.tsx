import { useState, useRef } from 'react';
import { StyleSheet, FlatList, Pressable, View, TextInput, Text, ActivityIndicator, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';

const ASI_ENDPOINT = 'https://inference.asicloud.cudos.org/v1/chat/completions';
const ASI_MODEL = 'asi1-mini';
const ASI_API_KEY = process.env.EXPO_PUBLIC_ASI_API_KEY || 'sk-OUW3HRFwVaiN8ySQp0-UPzgbdNdxoaRG9L55MFSmkB8';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const db = useDb();
  const flatListRef = useRef<FlatList>(null);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      text,
      time: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    Keyboard.dismiss();

    try {
      // Get context from DB
      const products = await db.getAllAsync<any>(
        "SELECT title, data FROM form WHERE type = 'product' AND active = 1 LIMIT 10"
      );
      const items = await db.getAllAsync<any>(
        "SELECT m.*, f.title as product_name FROM matter m JOIN form f ON f.id = m.form WHERE m.type = 'stock' AND m.active = 1 LIMIT 10"
      );

      const context = products.length > 0
        ? `Products: ${products.map((p: any) => p.title).join(', ')}`
        : 'No products yet.';
      const stockContext = items.length > 0
        ? `Stock: ${items.map((i: any) => `${i.product_name} (${i.qty} nos)`).join(', ')}`
        : 'No stock data.';

      const systemPrompt = `You are tarai, a helpful business assistant for a store management app.
You can help with products, inventory, sales, and business decisions.
Context: ${context}. ${stockContext}.
Be concise and helpful. Reply in 2-3 sentences max.`;

      const res = await fetch(ASI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ASI_API_KEY}`,
        },
        body: JSON.stringify({
          model: ASI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-10).map(m => ({ role: m.role, content: m.text })),
            { role: 'user', content: text },
          ],
        }),
      });

      const json = await res.json();
      const reply = json?.choices?.[0]?.message?.content || 'Sorry, I could not respond.';

      const assistantMsg: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        text: reply,
        time: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const errorMsg: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        text: 'Something went wrong. Please try again.',
        time: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageBubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
      <Text style={[styles.messageText, { color: item.role === 'user' ? '#fff' : theme.text }]}>
        {item.text}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.backgroundElement }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>tarai</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Ask me anything about your store, products, or inventory.
            </Text>
          </View>
        }
      />

      {/* Input */}
      <View style={[styles.inputBar, { backgroundColor: theme.background, borderTopColor: theme.backgroundElement, paddingBottom: insets.bottom + 8 }]}>
        <View style={[styles.inputInner, { backgroundColor: theme.backgroundElement }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={input}
            onChangeText={setInput}
            placeholder="Ask tarai..."
            placeholderTextColor={theme.textSecondary}
            multiline
            editable={!loading}
          />
          <Pressable
            style={[styles.sendBtn, { opacity: input.trim() && !loading ? 1 : 0.4 }]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#5E6AD2" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  headerRight: { width: 32 },
  messageList: { padding: 16, paddingBottom: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 100, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  messageBubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#5E6AD2' },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.05)' },
  messageText: { fontSize: 15, lineHeight: 20 },
  inputBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 8 },
  inputInner: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24, paddingLeft: 16, paddingRight: 4, paddingVertical: 4 },
  input: { flex: 1, fontSize: 16, maxHeight: 100, paddingVertical: 8 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#5E6AD2', justifyContent: 'center', alignItems: 'center' },
});
