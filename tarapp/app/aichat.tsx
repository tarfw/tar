import React, { useState, useRef, useEffect } from "react";
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
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { useLLM } from "react-native-executorch";
import * as SecureStore from "expo-secure-store";
import { LFM_MODELS } from "./profile";
export default function AiChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);

  const [activeModel, setActiveModel] = useState<any>(LFM_MODELS.LFM2_5_350M_FP16);
  const [isModelLoading, setIsModelLoading] = useState(true);

  useEffect(() => {
    async function loadSelectedModel() {
      try {
        const storedModelId = await SecureStore.getItemAsync("selected_lfm_model_id");
        if (storedModelId && LFM_MODELS[storedModelId as keyof typeof LFM_MODELS]) {
          setActiveModel(LFM_MODELS[storedModelId as keyof typeof LFM_MODELS]);
        }
      } catch (e) {
        console.error("Error loading selected model:", e);
      } finally {
        setIsModelLoading(false);
      }
    }
    loadSelectedModel();
  }, []);

  // Initialize Software Mansion useLLM hook
  const llm = useLLM({
    model: activeModel,
    preventLoad: isModelLoading,
  });

  const { configure, isReady } = llm;

  // Set system prompt when the model becomes ready
  useEffect(() => {
    if (isReady) {
      configure({
        chatConfig: {
          systemPrompt: "You are a helpful, extremely concise, and precise AI assistant running locally on the user's mobile device. Keep answers short and sweet."
        }
      });
    }
  }, [isReady, configure]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    let timeoutId: any = null;
    if (scrollViewRef.current) {
      timeoutId = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [llm.messageHistory, llm.response, llm.isGenerating]);

  const handleSend = async () => {
    if (!inputText.trim() || !llm.isReady || llm.isGenerating) return;

    const message = inputText.trim();
    setInputText("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await llm.sendMessage(message);
    } catch (err: any) {
      console.error("AI chat error:", err);
      Alert.alert("Inference Error", err?.message || "Something went wrong while generating response.");
    }
  };

  const handleClearContext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (llm.isGenerating) {
      llm.interrupt();
    }
    llm.deleteMessage(0);
  };

  const getDownloadPercentage = () => {
    return Math.round(llm.downloadProgress * 100);
  };

  // Render download/loading states
  if (!llm.isReady) {
    const isDownloading = llm.downloadProgress > 0 && llm.downloadProgress < 1;

    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Local AI</Text>
            </View>
          </View>

          {/* Loading Content */}
          <View style={styles.loadingContainer}>
            {llm.error ? (
              <View style={styles.errorWrapper}>
                <Ionicons name="alert-circle-outline" size={60} color="#ef4444" />
                <Text style={styles.errorTitle}>Failed to Load Model</Text>
                <Text style={styles.errorDescription}>
                  {llm.error.message || "An error occurred during model setup. Please check your internet connection."}
                </Text>
                <TouchableOpacity 
                  style={styles.retryBtn} 
                  onPress={() => router.replace("/aichat")}
                >
                  <Text style={styles.retryBtnText}>Retry Setup</Text>
                </TouchableOpacity>
              </View>
            ) : isDownloading ? (
              <View style={styles.progressWrapper}>
                <View style={styles.aiIconBadge}>
                  <Ionicons name="cloud-download-outline" size={40} color="#18181b" />
                </View>
                <Text style={styles.loadingTitle}>Downloading {activeModel?.name || "model"}...</Text>
 
                 {/* Progress bar */}
                 <View style={styles.progressBarContainer}>
                   <View style={[styles.progressBarFill, { width: `${getDownloadPercentage()}%` }]} />
                 </View>
                 <Text style={styles.progressPercent}>{getDownloadPercentage()}% downloaded</Text>
               </View>
             ) : (
               <View style={styles.progressWrapper}>
                 <ActivityIndicator size="large" color="#18181b" />
                 <Text style={[styles.loadingTitle, { marginTop: 24 }]}>
                   {isModelLoading ? "Loading settings..." : `Initializing ${activeModel?.name || "model"}...`}
                 </Text>
               </View>
             )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          {/* Top Bar Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Local AI</Text>
            </View>
            {llm.messageHistory.length > 0 && (
              <TouchableOpacity onPress={handleClearContext} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Conversation list */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatArea}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Existing messages */}
            {llm.messageHistory.map((msg: any, index: number) => {
              if (msg.role === "system") return null;
              const isUser = msg.role === "user";
              return (
                <View
                  key={index}
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.assistantBubble
                  ]}
                >
                  <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
                    {msg.content}
                  </Text>
                </View>
              );
            })}

            {/* Currently generating/streaming response */}
            {llm.isGenerating && llm.response.trim().length > 0 && (
              <View style={[styles.messageBubble, styles.assistantBubble]}>
                <Text style={[styles.messageText, styles.assistantText]}>
                  {llm.response}
                  <Text style={styles.cursor}>█</Text>
                </Text>
              </View>
            )}

            {/* Thinking state (generating but no tokens yet) */}
            {llm.isGenerating && llm.response.trim().length === 0 && (
              <View style={[styles.messageBubble, styles.assistantBubble]}>
                <ActivityIndicator size="small" color="#18181b" style={{ alignSelf: "flex-start" }} />
              </View>
            )}
          </ScrollView>

          {/* Bottom input area */}
          <View style={[styles.inputOuterContainer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Ask offline AI..."
                placeholderTextColor="#94a3b8"
                value={inputText}
                onChangeText={setInputText}
                multiline
                editable={!llm.isGenerating}
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!inputText.trim() || llm.isGenerating) && styles.sendBtnDisabled
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() || llm.isGenerating}
              >
                <Ionicons 
                  name="arrow-up" 
                  size={18} 
                  color={(!inputText.trim() || llm.isGenerating) ? "#a1a1aa" : "#ffffff"} 
                />
              </TouchableOpacity>
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
    backgroundColor: "#ffffff",
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
    backgroundColor: "#ffffff",
  },
  backBtn: {
    padding: 4,
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  progressWrapper: {
    alignItems: "center",
    width: "100%",
  },
  aiIconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f4f4f5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: "center",
  },
  progressBarContainer: {
    width: "100%",
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#18181b",
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "700",
    color: "#18181b",
  },
  errorWrapper: {
    alignItems: "center",
    width: "100%",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ef4444",
    marginTop: 16,
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  chatArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  chatContent: {
    padding: 20,
    paddingBottom: 40,
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#18181b",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#f4f4f5",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: "#ffffff",
  },
  assistantText: {
    color: "#18181b",
  },
  cursor: {
    color: "#18181b",
    fontWeight: "bold",
  },
  inputOuterContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#f4f4f5",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#f4f4f5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: "#18181b",
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#18181b",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  sendBtnDisabled: {
    backgroundColor: "#f4f4f5",
  },
  clearBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#71717a",
  }
});
