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

// Configuration for Software Mansion's LFM 2.5 350M quantized model
const LFM2_5_350M_QUANTIZED = {
  modelSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.8.0/lfm2.5-350M/xnnpack/lfm2_5_350m_xnnpack_8w4da.pte",
  tokenizerSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.8.0/lfm2.5-350M/tokenizer.json",
  tokenizerConfigSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.8.0/lfm2.5-350M/tokenizer_config.json"
};

export default function AiChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);

  // Initialize Software Mansion useLLM hook
  const llm = useLLM({
    model: LFM2_5_350M_QUANTIZED,
    preventLoad: false,
  });

  // Set system prompt when the model becomes ready
  useEffect(() => {
    if (llm.isReady) {
      llm.configure({
        chatConfig: {
          systemPrompt: "You are a helpful, extremely concise, and precise AI assistant running locally on the user's mobile device. Keep answers short and sweet."
        }
      });
    }
  }, [llm.isReady, llm]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
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
              <Text style={styles.headerSubtitle}>Offline Assistant</Text>
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
                  <Ionicons name="cloud-download-outline" size={40} color="#6366f1" />
                </View>
                <Text style={styles.loadingTitle}>Downloading Local Model</Text>
                <Text style={styles.loadingDescription}>
                  Fetching LFM 2.5 350M (~160MB) to run offline directly on your CPU. This only happens once.
                </Text>

                {/* Progress bar */}
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarFill, { width: `${getDownloadPercentage()}%` }]} />
                </View>
                <Text style={styles.progressPercent}>{getDownloadPercentage()}% downloaded</Text>
              </View>
            ) : (
              <View style={styles.progressWrapper}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={[styles.loadingTitle, { marginTop: 24 }]}>Initializing ExecuTorch</Text>
                <Text style={styles.loadingDescription}>
                  Loading model weights into device RAM. Please hold on.
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
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.headerTitle}>Local AI</Text>
                <View style={styles.offlineBadge}>
                  <Text style={styles.offlineBadgeText}>OFFLINE</Text>
                </View>
              </View>
              <Text style={styles.headerSubtitle}>LFM 2.5 350M model</Text>
            </View>
            <View style={styles.statusIndicatorRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Ready</Text>
            </View>
          </View>

          {/* Conversation list */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatArea}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Disclaimer card */}
            <View style={styles.disclaimerCard}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#6366f1" style={{ marginRight: 8 }} />
              <Text style={styles.disclaimerText}>
                No servers. No data tracking. Fully executed on-device.
              </Text>
            </View>

            {llm.messageHistory.length === 0 && (
              <View style={styles.introContainer}>
                <View style={styles.introLogo}>
                  <Text style={styles.introLogoText}>TAR AI</Text>
                </View>
                <Text style={styles.introTitle}>Local Intelligence</Text>
                <Text style={styles.introSubtitle}>
                  Ask anything. The query is computed offline using local CPU matrices.
                </Text>
              </View>
            )}

            {/* Existing messages */}
            {llm.messageHistory.map((msg, index) => {
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
                  {!isUser && (
                    <View style={styles.assistantBadge}>
                      <Ionicons name="hardware-chip-outline" size={10} color="#6366f1" style={{ marginRight: 2 }} />
                      <Text style={styles.assistantBadgeText}>LFM 350M</Text>
                    </View>
                  )}
                  <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
                    {msg.content}
                  </Text>
                </View>
              );
            })}

            {/* Currently generating/streaming response */}
            {llm.isGenerating && llm.response.trim().length > 0 && (
              <View style={[styles.messageBubble, styles.assistantBubble]}>
                <View style={styles.assistantBadge}>
                  <Ionicons name="hardware-chip-outline" size={10} color="#6366f1" style={{ marginRight: 2 }} />
                  <Text style={styles.assistantBadgeText}>LFM 350M</Text>
                </View>
                <Text style={[styles.messageText, styles.assistantText]}>
                  {llm.response}
                  <Text style={styles.cursor}>█</Text>
                </Text>
              </View>
            )}

            {/* Thinking state (generating but no tokens yet) */}
            {llm.isGenerating && llm.response.trim().length === 0 && (
              <View style={[styles.messageBubble, styles.assistantBubble]}>
                <ActivityIndicator size="small" color="#6366f1" style={{ alignSelf: "flex-start" }} />
              </View>
            )}
          </ScrollView>

          {/* Bottom input area */}
          <View style={[styles.inputOuterContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Ask offline AI..."
                placeholderTextColor="#94a3b8"
                value={inputText}
                onChangeText={setInputText}
                multiline
                disabled={llm.isGenerating}
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!inputText.trim() || llm.isGenerating) && styles.sendBtnDisabled
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() || llm.isGenerating}
              >
                <Ionicons name="arrow-up" size={20} color="#fff" />
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
    borderBottomColor: "#f1f5f9",
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
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  offlineBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  offlineBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  statusIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16a34a",
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
    backgroundColor: "#eef2ff",
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
  loadingDescription: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
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
    backgroundColor: "#6366f1",
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6366f1",
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
    backgroundColor: "#fafafa",
  },
  chatContent: {
    padding: 20,
    paddingBottom: 40,
  },
  disclaimerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  disclaimerText: {
    fontSize: 12,
    color: "#64748b",
    flex: 1,
  },
  introContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    paddingHorizontal: 20,
  },
  introLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  introLogoText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  introTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#0f172a",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderBottomLeftRadius: 4,
  },
  assistantBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eef2ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  assistantBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6366f1",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: "#ffffff",
  },
  assistantText: {
    color: "#1e293b",
  },
  cursor: {
    color: "#6366f1",
    fontWeight: "bold",
  },
  inputOuterContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: "#0f172a",
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  sendBtnDisabled: {
    backgroundColor: "#cbd5e1",
  }
});
