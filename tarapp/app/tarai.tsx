import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { getDbClient } from "../lib/db";
import { upsertMatterVector } from "../lib/vectorStore";
import { activeMassId } from "../lib/state";

import { ResourceFetcher, WHISPER_TINY, useSpeechToText } from "react-native-executorch";
import { AudioRecorder, AudioManager } from "react-native-audio-api";

const getFilenameFromUri = (uri: string) => {
  let cleanUri = uri.replace(/^https?:\/\//, '');
  cleanUri = cleanUri.split('#')?.[0] ?? cleanUri;
  return cleanUri.replace(/[^a-zA-Z0-9._-]/g, '_');
};

const checkWhisperDownloaded = async () => {
  try {
    const files = await ResourceFetcher.listDownloadedFiles();
    const encoderFilename = getFilenameFromUri(WHISPER_TINY.encoderSource);
    const decoderFilename = getFilenameFromUri(WHISPER_TINY.decoderSource);
    return files.some(f => f.endsWith(encoderFilename)) && files.some(f => f.endsWith(decoderFilename));
  } catch {
    return false;
  }
};

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

  // Whisper speech to text integration
  const [shouldLoadWhisper, setShouldLoadWhisper] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [sttError, setSttError] = useState<string | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);

  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  useEffect(() => {
    async function checkStatus() {
      const downloaded = await checkWhisperDownloaded();
      if (downloaded) {
        setShouldLoadWhisper(true);
      }
    }
    checkStatus();
  }, []);

  const stt = useSpeechToText({
    model: WHISPER_TINY,
    preventLoad: !shouldLoadWhisper || !isFocused,
  });

  const sttRef = useRef(stt);
  useEffect(() => {
    sttRef.current = stt;
  }, [stt]);

  const startRecording = async () => {
    try {
      const permission = await AudioManager.requestRecordingPermissions();
      if (permission !== "Granted") {
        Alert.alert("Permission Denied", "Microphone permission is required for voice dictation.");
        return;
      }

      if (!sttRef.current.isReady) {
        Alert.alert("Loading Model", "Voice model is still loading. Please wait a moment.");
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsRecording(true);
      setSttError(null);
      audioChunksRef.current = [];

      if (!audioRecorderRef.current) {
        audioRecorderRef.current = new AudioRecorder();
      }

      audioRecorderRef.current.onAudioReady(
        {
          sampleRate: 16000,
          bufferLength: 1600,
          channelCount: 1,
        },
        (event: any) => {
          const buffer = event.buffer.getChannelData(0);
          audioChunksRef.current.push(new Float32Array(buffer));

          // Calculate volume level (RMS)
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
          }
          const rms = Math.sqrt(sum / buffer.length);
          setAudioLevel(Math.min(1, rms * 10));
        }
      );

      audioRecorderRef.current.start();
    } catch (err) {
      console.error("Failed to start recording:", err);
      setIsRecording(false);
      Alert.alert("Error", "Could not start microphone recording.");
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setIsRecording(false);
    setAudioLevel(0);

    try {
      if (audioRecorderRef.current) {
        audioRecorderRef.current.stop();
        audioRecorderRef.current.clearOnAudioReady();
      }

      const chunks = audioChunksRef.current;
      if (chunks.length > 0) {
        // Combine chunks into a single Float32Array
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combined = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        console.log(`[Whisper STT] Starting transcription on ${totalLength} samples...`);
        const result = await sttRef.current.transcribe(combined, { language: 'en' });
        if (result && result.trim()) {
          const cleanText = result
            .replace(/\[[^\]]*\]/g, "")
            .replace(/\([^)]*\)/g, "")
            .replace(/\[BLANK_AUDIO\]/gi, "")
            .trim();
          if (cleanText) {
            console.log(`[Whisper STT] Transcription completed: "${cleanText}"`);
            setInputText((prev) => prev + (prev ? " " : "") + cleanText);
          } else {
            console.log(`[Whisper STT] Transcription completed but contained only blank audio tokens.`);
          }
        } else {
          console.log(`[Whisper STT] Transcription completed but output was empty.`);
        }
      }
    } catch (err) {
      console.error("Failed to stop recording or transcribe:", err);
      setSttError("Error transcribing audio.");
    }
  };

  const handleMicPress = async () => {
    const downloaded = await checkWhisperDownloaded();
    if (!downloaded) {
      Alert.alert(
        "Voice Model Required",
        "To use offline dictation, please go to your Profile settings and download the Offline Voice Dictation model.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Go to Profile", onPress: () => router.push("/profile") }
        ]
      );
      return;
    }

    if (!shouldLoadWhisper) {
      setShouldLoadWhisper(true);
      return;
    }

    if (!stt.isReady) {
      return;
    }

    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };
  
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

        {/* Live Transcription Preview Overlay */}
        {isRecording && (
          <View style={styles.transcriptionOverlay}>
            <View style={styles.recordingIndicatorContainer}>
              <View style={[
                styles.recordingDot, 
                { transform: [{ scale: 1 + audioLevel * 0.5 }] }
              ]} />
              <Text style={styles.recordingText}>Listening...</Text>
            </View>
            <ScrollView style={styles.transcriptionScroll} contentContainerStyle={styles.transcriptionTextContainer}>
              <Text style={styles.transcriptionText}>
                {stt.committedTranscription || "..."}
                <Text style={styles.nonCommittedText}>
                  {stt.nonCommittedTranscription}
                </Text>
              </Text>
            </ScrollView>
          </View>
        )}

        {/* Transcribing Loader */}
        {stt.isGenerating && (
          <View style={styles.transcriptionOverlay}>
            <View style={styles.recordingIndicatorContainer}>
              <ActivityIndicator size="small" color="#f59e0b" style={{ marginRight: 8 }} />
              <Text style={[styles.recordingText, { color: '#f59e0b' }]}>Transcribing audio...</Text>
            </View>
          </View>
        )}

        {/* Input Area */}
        <View style={[styles.inputOuterContainer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.inputContainer}>
            <TouchableOpacity 
              style={[
                styles.micBtn, 
                isRecording && styles.micBtnRecording
              ]} 
              onPress={handleMicPress}
            >
              {shouldLoadWhisper && !stt.isReady ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons 
                  name={isRecording ? "stop" : "mic"} 
                  size={20} 
                  color={isRecording ? "#fff" : "#000"} 
                />
              )}
            </TouchableOpacity>

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
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  micBtnRecording: {
    backgroundColor: '#ff3b30',
  },
  transcriptionOverlay: {
    backgroundColor: '#fcfcfc',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    padding: 16,
    maxHeight: 120,
  },
  recordingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  transcriptionScroll: {
    flex: 1,
  },
  transcriptionTextContainer: {
    paddingVertical: 4,
  },
  transcriptionText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 20,
  },
  nonCommittedText: {
    color: '#888',
  }
});
