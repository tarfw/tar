import React, { useState, useRef, useEffect } from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { getDbClient } from "../lib/db";
import { upsertMatterVector } from "../lib/vectorStore";
import { activeMassId } from "../lib/state";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const MODEL = "openai/gpt-oss-120b";

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent';
  timestamp: Date;
}

export default function TarAiScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hi there! I am your Orchestrator Agent. You can ask me to log sales, schedule tasks, check inventory, or create reminders. What would you like to do?",
      sender: 'agent',
      timestamp: new Date()
    }
  ]);

  useEffect(() => {
    // Small timeout ensures layout is painted before scrolling
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    const newUserMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputText("");

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
               content: `You are the TAR AI Agent. Map requests to 4 tables:
1. matter (entities/products/tasks): id, code, type, scope, title, data
2. mass (inventory/time/price): id, matter, type, scope, qty, value, geo, start, end, data
3. relation (links): src, tgt, type
4. motion (events/logs): id, stream, seq, action, status, delta, data

OPCODES for motion.action:
- 1: SALE (Logged a sale/receipt)
- 105: REMINDER (Simple notification/reminder)
- 200: TASK (Actionable To-Do item)
- 100: SYSTEM/UPDATE (Generic inventory or system change)

MODELING RULES:
- Note (pure idea): Create only a 'matter' entry with type="note".
- Task (to-do): Create a 'matter' with type="task" and a corresponding 'motion' (stream=matter.id, action=200, status="OPEN").
- Reminder: Create a 'matter' with type="task" and a corresponding 'mass' entry (matter=matter.id, type="slot", scope="reminder", start="YYYY-MM-DD HH:MM:SS" when it should trigger).
- Scheduled Task (Deadline): Create a 'matter' with type="task", a 'mass' entry (matter=matter.id, type="slot", scope="deadline", start="YYYY-MM-DD" due date), and a 'motion' (stream=matter.id, action=200, status="OPEN").

IMPORTANT: motion.delta MUST be a number (e.g. 250 or -5), NOT a JSON string or object.

${activeMassId ? `CONTEXT: The user is currently focused on an ACTIVE MASS record with ID: "${activeMassId}". If the user asks to update "this", "the stock", or "the price", you MUST use this ID for the 'mass' entry and relevant 'motions'.` : ""}

Output pure JSON exactly:
{
  "reply": "Short confirmation",
  "matters": [],
  "masses": [],
  "relations": [],
  "motions": [{ "id": "mot_1", "stream": "task_123", "seq": 1, "action": 200, "status": "OPEN", "data": "{\\"task\\":\\"Sleep for 1 hour\\"}" }]
}
Use string IDs to link items. Omit arrays if empty. NO markdown.`
            },
            {
              role: "user",
              content: userText
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const json = await response.json();
      const content = json.choices[0].message.content;
      const parsed = JSON.parse(content);

      const db = getDbClient();
      let hasChanges = false;

      // The LLM often copies example IDs like "mat_1". We must remap them to real unique IDs.
      const idMap = new Map();
      const mapId = (oldId: string, prefix: string) => {
        if (!oldId) return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        // If the LLM generated a short fake ID (like "mat_1"), map it to a true unique ID
        if (oldId.length < 15) {
          if (!idMap.has(oldId)) {
            idMap.set(oldId, `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`);
          }
          return idMap.get(oldId);
        }
        return oldId; // It's probably a real ID already
      };

      if (parsed.matters && parsed.matters.length > 0) {
        for (const m of parsed.matters) {
           const remappedId = mapId(m.id, 'mat');
           await db.run(
             "INSERT OR REPLACE INTO matter (id, code, type, title, data) VALUES (?, ?, ?, ?, ?)",
             [remappedId, m.code || null, m.type || null, m.title || null, m.data || null]
           );

           // Sync local vector representation
           try {
             await upsertMatterVector(remappedId, {
               title: m.title || "",
               type: m.type || null,
               scope: m.scope || null,
               code: m.code || null,
               data: m.data || null
             });
           } catch (vectorErr) {
             console.error("Vector sync failed in TarAi parsed.matters:", vectorErr);
           }
        }
        hasChanges = true;
      }

      if (parsed.masses && parsed.masses.length > 0) {
        for (const m of parsed.masses) {
           await db.run(
             "INSERT OR REPLACE INTO mass (id, matter, type, qty, value, start, end, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
             [mapId(m.id, 'mas'), mapId(m.matter, 'mat'), m.type || null, m.qty || null, m.value || null, m.start || null, m.end || null, m.data || null]
           );
        }
        hasChanges = true;
      }

      if (parsed.relations && parsed.relations.length > 0) {
        for (const r of parsed.relations) {
           await db.run(
             "INSERT INTO relation (src, tgt, type) VALUES (?, ?, ?)",
             [mapId(r.src, 'mat'), mapId(r.tgt, 'mat'), r.type]
           );
        }
        hasChanges = true;
      }

      if (parsed.motions && parsed.motions.length > 0) {
        for (const m of parsed.motions) {
          const streamId = mapId(m.stream, 'mat');
          const seqRow = await db.all(
            "SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?",
            [streamId]
          );
          const seq = seqRow[0]?.next_seq || 1;
           await db.run(
             "INSERT INTO motion (id, stream, seq, action, status, delta, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
             [mapId(m.id, 'mot'), streamId, seq, m.action || 1, m.status || "OPEN", m.delta || null, m.data || null]
           );
        }
        hasChanges = true;
      }

      if (hasChanges) {
        await db.push();
      }

      const newAgentMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: parsed.reply || "Done.",
        sender: 'agent',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newAgentMsg]);

    } catch (error) {
      console.error("Groq API Error:", error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I ran into an error processing that request. Please check the console.",
        sender: 'agent',
        timestamp: new Date()
      }]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar style="dark" />
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          title: 'tar ai', 
          headerShadowVisible: false,
          headerBackTitleVisible: false,
          headerTintColor: '#000',
          headerStyle: { backgroundColor: '#fff' },
          animation: 'fade',
          presentation: 'transparentModal'
        } as any} 
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['bottom', 'left', 'right']}>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 100}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1 }}>
        {/* Chat Area */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
        >
          {messages.map((msg) => (
            <View 
              key={msg.id} 
              style={[
                styles.messageBubble, 
                msg.sender === 'user' ? styles.userBubble : styles.agentBubble
              ]}
            >
              <Text style={[
                styles.messageText,
                msg.sender === 'user' ? styles.userText : styles.agentText
              ]}>
                {msg.text}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Input Area */}
        <View style={[styles.inputOuterContainer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Type a command..."
              placeholderTextColor="#999"
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} 
              onPress={handleSend}
              disabled={!inputText.trim()}
            >
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardView: {
    flex: 1,
  },
  chatArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  chatContent: {
    padding: 20,
    paddingBottom: 40,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 20,
    marginBottom: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#000',
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eaeaea',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  agentText: {
    color: '#333',
  },
  inputOuterContainer: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    color: '#333',
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  sendBtnDisabled: {
    backgroundColor: '#ccc',
  }
});
