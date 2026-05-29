import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Modal,
  Image
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Stack, useFocusEffect } from "expo-router";
import { ResourceFetcher, SSDLITE_320_MOBILENET_V3_LARGE, CLIP_VIT_BASE_PATCH32_IMAGE } from "react-native-executorch";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import { getUserDb } from "../lib/db";
import { uploadFileToS3 } from "../lib/s3";
import * as FileSystemStore from "expo-file-system/legacy";
import { signOutGoogle, getCurrentUser, UserProfile } from "../lib/auth";

export const LFM_MODELS = {
  LFM2_5_350M_QUANTIZED: {
    id: "LFM2_5_350M_QUANTIZED",
    name: "LFM 2.5 350M (Quantized)",
    size: "454 MB",
    modelSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.8.0/lfm2.5-350M/xnnpack/lfm2_5_350m_xnnpack_8w4da.pte",
    tokenizerSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.8.0/lfm2.5-350M/tokenizer.json",
    tokenizerConfigSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.8.0/lfm2.5-350M/tokenizer_config.json"
  },
  LFM2_5_350M_FP16: {
    id: "LFM2_5_350M_FP16",
    name: "LFM 2.5 350M (FP16)",
    size: "845 MB",
    modelSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.8.0/lfm2.5-350M/xnnpack/lfm2_5_350m_xnnpack_fp16.pte",
    tokenizerSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.8.0/lfm2.5-350M/tokenizer.json",
    tokenizerConfigSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.8.0/lfm2.5-350M/tokenizer_config.json"
  },
  LFM2_5_1_2B_INSTRUCT_QUANTIZED: {
    id: "LFM2_5_1_2B_INSTRUCT_QUANTIZED",
    name: "LFM 2.5 1.2B Instruct (Quantized)",
    size: "796 MB",
    modelSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm2.5-1.2B-instruct/resolve/v0.8.0/quantized/lfm2_5_1_2b_8da4w.pte",
    tokenizerSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm2.5-1.2B-instruct/resolve/v0.8.0/tokenizer.json",
    tokenizerConfigSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm2.5-1.2B-instruct/resolve/v0.8.0/tokenizer_config.json"
  }
};

export const UTILITY_MODELS = {
  SSDLITE_DETECTOR: {
    id: "SSDLITE_DETECTOR",
    name: "Object Detector (SSDLite MobileNetV3)",
    size: "20 MB",
    modelSource: SSDLITE_320_MOBILENET_V3_LARGE.modelSource,
    description: "Locates candidate product objects in photos for matching."
  },
  YOLO26S_DETECTOR: {
    id: "YOLO26S_DETECTOR",
    name: "Object Detector (YOLO26 Small)",
    size: "16 MB",
    modelSource: "https://huggingface.co/software-mansion/react-native-executorch-yolo26/resolve/v0.7.0/yolo26s/xnnpack/yolo26s.pte",
    description: "Real-time object detector model optimized with XNNPACK."
  },
  CLIP_MATCHER: {
    id: "CLIP_MATCHER",
    name: "Photo Feature Matcher (CLIP ViT-B/32)",
    size: "87 MB",
    modelSource: CLIP_VIT_BASE_PATCH32_IMAGE.modelSource,
    description: "Extracts visual feature embeddings to match products."
  }
};


export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [backupFreq, setBackupFreq] = useState<"daily" | "weekly">("daily");
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string>("Never");
  const [pricingPlan, setPricingPlan] = useState<string>("Free");
  const [tokens, setTokens] = useState<number>(0);
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [showAddTokensDrawer, setShowAddTokensDrawer] = useState(false);

  const handlePurchaseTokens = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const addedTokens = 3000000;
      const finalTokens = tokens + addedTokens;
      
      setTokens(finalTokens);
      setPricingPlan("Paid");
      setShowAddTokensDrawer(false);

      await SecureStore.setItemAsync("user_tokens", finalTokens.toString());
      await SecureStore.setItemAsync("user_pricing_plan", "Paid");



      Alert.alert(
        "Tokens Added",
        `Successfully added ${addedTokens.toLocaleString()} tokens.\nYour collaborative database is now synced.`,
        [{ text: "OK" }]
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not complete the purchase.");
    }
  };

  const [activeModelId, setActiveModelId] = useState<string>("LFM2_5_350M_FP16");
  const [downloadedModels, setDownloadedModels] = useState<Record<string, boolean>>({});
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const getFilenameFromUri = (uri: string) => {
    let cleanUri = uri.replace(/^https?:\/\//, '');
    cleanUri = cleanUri.split('#')?.[0] ?? cleanUri;
    return cleanUri.replace(/[^a-zA-Z0-9._-]/g, '_');
  };

  // Check downloaded model files status
  const checkFilesStatus = useCallback(async () => {
    try {
      const files = await ResourceFetcher.listDownloadedFiles() as string[];

      const statusMap: Record<string, boolean> = {};
      
      // Check LLMs
      for (const key of Object.keys(LFM_MODELS)) {
        const model = LFM_MODELS[key as keyof typeof LFM_MODELS];
        const modelFn = getFilenameFromUri(model.modelSource);
        const tokenizerFn = getFilenameFromUri(model.tokenizerSource);
        const hasModel = files.some((f: string) => f.endsWith(modelFn));
        const hasTokenizer = files.some((f: string) => f.endsWith(tokenizerFn));
        statusMap[key] = hasModel && hasTokenizer;
      }

      // Check Utilities
      for (const key of Object.keys(UTILITY_MODELS)) {
        const model = UTILITY_MODELS[key as keyof typeof UTILITY_MODELS];
        const modelFn = getFilenameFromUri(model.modelSource);
        statusMap[key] = files.some((f: string) => f.endsWith(modelFn));
      }

      setDownloadedModels(statusMap);
    } catch (e) {
      console.error("Error checking model files:", e);
    }
  }, []);

  useEffect(() => {
    checkFilesStatus();
  }, [checkFilesStatus]);

  const handleDownloadModel = async (modelKey: string, isUtility: boolean) => {
    const model = isUtility 
      ? UTILITY_MODELS[modelKey as keyof typeof UTILITY_MODELS]
      : LFM_MODELS[modelKey as keyof typeof LFM_MODELS];

    if (downloadedModels[modelKey]) return;
    if (downloadingModelId) {
      Alert.alert("Busy", "Another model is currently downloading. Please wait.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Alert.alert(
      "Download Model",
      `Do you want to download ${model.name}? This file is ~${model.size}.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Download", 
          onPress: async () => {
            try {
              setDownloadingModelId(modelKey);
              setDownloadProgress(0);

              if (isUtility) {
                await ResourceFetcher.fetch(
                  (progress: number) => {
                    setDownloadProgress(Math.round(progress * 100));
                  },
                  model.modelSource
                );
              } else {
                const llmModel = model as typeof LFM_MODELS[keyof typeof LFM_MODELS];
                await ResourceFetcher.fetch(
                  (progress: number) => {
                    setDownloadProgress(Math.round(progress * 100));
                  },
                  llmModel.modelSource,
                  llmModel.tokenizerSource,
                  llmModel.tokenizerConfigSource
                );
              }

              setDownloadingModelId(null);
              setDownloadedModels(prev => ({ ...prev, [modelKey]: true }));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Success", `${model.name} downloaded and ready.`);
            } catch (err) {
              console.error(`Download failed for ${modelKey}:`, err);
              setDownloadingModelId(null);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Error", "Failed to download model files.");
            }
          }
        }
      ]
    );
  };

  const confirmDeleteModel = (modelKey: string, isUtility: boolean) => {
    const model = isUtility
      ? UTILITY_MODELS[modelKey as keyof typeof UTILITY_MODELS]
      : LFM_MODELS[modelKey as keyof typeof LFM_MODELS];

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      "Remove Model",
      `Are you sure you want to delete ${model.name} from your device?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              if (isUtility) {
                await ResourceFetcher.deleteResources(model.modelSource);
              } else {
                const llmModel = model as typeof LFM_MODELS[keyof typeof LFM_MODELS];
                await ResourceFetcher.deleteResources(
                  llmModel.modelSource,
                  llmModel.tokenizerSource,
                  llmModel.tokenizerConfigSource
                );
              }
              setDownloadedModels(prev => ({ ...prev, [modelKey]: false }));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Removed", `${model.name} deleted to free up space.`);
            } catch (e) {
              console.error("Error deleting model file:", e);
              Alert.alert("Error", "Failed to delete model file.");
            }
          }
        }
      ]
    );
  };

  const handleSelectModel = async (modelKey: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveModelId(modelKey);
    try {
      await SecureStore.setItemAsync("selected_lfm_model_id", modelKey);
    } catch (e) {
      console.error("Error saving active model ID:", e);
    }
  };



  // Reload preferences and tokens when the screen gets focus
  useFocusEffect(
    useCallback(() => {
      async function loadPreferences() {
        try {
          const user = await getCurrentUser();
          setUserProfile(user);

          const storedFreq = await SecureStore.getItemAsync("private_db_backup_frequency");
          if (storedFreq === "weekly" || storedFreq === "daily") {
            setBackupFreq(storedFreq);
          }

          const storedTime = await SecureStore.getItemAsync("private_db_last_backup_time");
          if (storedTime) {
            setLastBackupTime(storedTime);
          }

          const plan = await SecureStore.getItemAsync("user_pricing_plan");
          if (plan) {
            setPricingPlan(plan);
          } else {
            setPricingPlan("Free");
            await SecureStore.setItemAsync("user_pricing_plan", "Free");
          }

          const storedTokens = await SecureStore.getItemAsync("user_tokens");
          if (storedTokens !== null) {
            setTokens(parseInt(storedTokens, 10));
          } else {
            setTokens(0);
            await SecureStore.setItemAsync("user_tokens", "0");
          }

          const code = await SecureStore.getItemAsync("collab_group_code");
          if (code) {
            setGroupCode(code);
          }

          const storedModelId = await SecureStore.getItemAsync("selected_lfm_model_id");
          if (storedModelId && LFM_MODELS[storedModelId as keyof typeof LFM_MODELS]) {
            setActiveModelId(storedModelId);
          }

          await checkFilesStatus();
        } catch (e) {
          console.error("Failed to load secure settings:", e);
        }
      }
      loadPreferences();
    }, [checkFilesStatus])
  );

  const toggleBackupFreq = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newFreq = backupFreq === "daily" ? "weekly" : "daily";
      setBackupFreq(newFreq);
      await SecureStore.setItemAsync("private_db_backup_frequency", newFreq);
    } catch (e) {
      console.error(e);
    }
  };



  const handleBackupNow = async () => {
    setIsBackingUp(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const uDb = getUserDb();
      
      const tempFilename = "user_backup.db";
      const localTempUri = FileSystemStore.documentDirectory + tempFilename;
      let rawTempPath = localTempUri;
      if (rawTempPath.startsWith("file://")) {
        rawTempPath = rawTempPath.substring(7);
      }

      // 1. Delete previous temp file if exists
      try {
        await FileSystemStore.deleteAsync(localTempUri, { idempotent: true });
      } catch (_) {}

      // 2. Perform SQLite safe copy VACUUM INTO
      console.log(`[Backup] Vacuuming user database to ${rawTempPath}...`);
      await uDb.run("VACUUM INTO ?", [rawTempPath]);

      // 3. Upload vacuumed copy to S3 (private/{uid}/backups/...)
      console.log("[Backup] Uploading copy to S3...");
      const result = await uploadFileToS3(
        localTempUri,
        "user.db",
        "application/x-sqlite3",
        false
      );

      // 4. Delete local temp file
      await FileSystemStore.deleteAsync(localTempUri, { idempotent: true });

      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + 
                        ", " + new Date().toLocaleDateString([], { month: "short", day: "numeric" });
      setLastBackupTime(timestamp);
      await SecureStore.setItemAsync("private_db_last_backup_time", timestamp);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Backup Complete", `Private database backed up to Cloudflare S3 successfully!\nPath: ${result.key}`);
    } catch (e: any) {
      console.error("Backup failed:", e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Backup Failed", e.message || "Unable to safe-copy or upload private database.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleSignOut = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Sign Out", 
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              await signOutGoogle();
            } catch (err) {
              console.error("Error signing out:", err);
            }
            router.replace("/");
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ presentation: "modal" }} />
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        
        {/* User Card */}
        <View style={styles.profileHeader}>
          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={styles.profileInfoRow}
          >
            {userProfile?.photo ? (
              <Image source={{ uri: userProfile.photo }} style={styles.profileAvatar} />
            ) : (
              <View style={[styles.profileAvatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={24} color="#71717a" />
              </View>
            )}
            <View style={styles.profileHeaderNameContainer}>
              <Text style={styles.profileName}>{userProfile?.name || "Guest User"}</Text>
              <Text style={styles.profileUsername}>{userProfile?.email || "@guest"}</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.tokensValue}>
            {tokens.toLocaleString()} Tokens
          </Text>
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowAddTokensDrawer(true);
            }}
          >
            <Text style={styles.manageTokensText}>Add Tokens →</Text>
          </TouchableOpacity>
        </View>

        {/* Settings List */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.settingsList}>



            {/* GOOGLE ACCOUNT DETAILS */}
            {userProfile && (
              <>
                <View style={styles.sectionHeaderContainer}>
                  <Text style={styles.sectionHeader}>Google Account Details</Text>
                </View>
                
                <View style={styles.detailsCard}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>User ID</Text>
                    <Text style={styles.detailValue} selectable={true}>{userProfile.id}</Text>
                  </View>

                  {userProfile.idToken && (
                    <>
                      <View style={styles.detailSeparator} />
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>ID Token</Text>
                        <Text style={styles.detailValue} selectable={true}>
                          {userProfile.idToken}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                <View style={styles.separator} />
              </>
            )}

            {/* DATABASE & MODEL CONTROLS */}
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionHeader}>Storage & Models</Text>
            </View>

            {/* Backup Frequency Toggle */}
            <TouchableOpacity style={styles.row} onPress={toggleBackupFreq} activeOpacity={0.7}>
              <Text style={styles.rowLabel}>Backup Frequency</Text>
              <Text style={styles.rowValue}>{backupFreq === "daily" ? "Daily" : "Weekly"}</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* Backup Action */}
            <TouchableOpacity 
              style={styles.row} 
              onPress={handleBackupNow} 
              disabled={isBackingUp}
              activeOpacity={0.7}
            >
              <View>
                <Text style={styles.rowLabel}>Backup Database</Text>
                <Text style={styles.rowSublabel}>Last sync: {lastBackupTime}</Text>
              </View>
              {isBackingUp ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.rowActionText}>Run Now</Text>
              )}
            </TouchableOpacity>

            <View style={styles.separator} />



            {/* Offline AI Models Section */}
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionHeader}>Offline AI Models</Text>
            </View>

            {/* Sub-group 1: Text Chat Assistants */}
            <View style={styles.subHeaderContainer}>
              <Text style={styles.subHeader}>Text Chat Assistants</Text>
            </View>
            <View style={styles.separator} />

            {Object.keys(LFM_MODELS).map((key) => {
              const model = LFM_MODELS[key as keyof typeof LFM_MODELS];
              const isSelected = activeModelId === key;
              const isDownloaded = downloadedModels[key];
              const isDownloading = downloadingModelId === key;

              return (
                <View key={key}>
                  <View style={[styles.row, isSelected && styles.selectedModelRow]}>
                    <TouchableOpacity 
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingRight: 10 }}
                      onPress={() => handleSelectModel(key)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.radioContainer}>
                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowLabel, isSelected && { fontWeight: "700" }]}>{model.name}</Text>
                        <Text style={styles.rowSublabel}>
                          {isDownloaded 
                            ? `Model ready • Tap to select (${model.size})` 
                            : isDownloading 
                              ? `Downloading model... ${downloadProgress}%` 
                              : `Tap to select • Download size: ~${model.size}`}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {isDownloading ? (
                      <ActivityIndicator size="small" color="#000000" />
                    ) : isDownloaded ? (
                      <TouchableOpacity onPress={() => confirmDeleteModel(key, false)} style={{ paddingLeft: 12 }}>
                        <Text style={[styles.rowActionText, { color: "#ef4444" }]}>Remove</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => handleDownloadModel(key, false)} style={{ paddingLeft: 12 }}>
                        <Text style={styles.rowActionText}>Download</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.separator} />
                </View>
              );
            })}

            {/* Sub-group 2: Photo Search Utilities */}
            <View style={styles.subHeaderContainer}>
              <Text style={styles.subHeader}>Photo Search Utilities</Text>
            </View>
            <View style={styles.separator} />

            {Object.keys(UTILITY_MODELS).map((key) => {
              const model = UTILITY_MODELS[key as keyof typeof UTILITY_MODELS];
              const isDownloaded = downloadedModels[key];
              const isDownloading = downloadingModelId === key;

              return (
                <View key={key}>
                  <View style={styles.row}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.rowLabel}>{model.name}</Text>
                      <Text style={styles.rowSublabel}>
                        {isDownloaded 
                          ? `${model.description} (Ready • ${model.size})` 
                          : isDownloading 
                            ? `Downloading... ${downloadProgress}%` 
                            : `${model.description} (Size: ~${model.size})`}
                      </Text>
                    </View>

                    {isDownloading ? (
                      <ActivityIndicator size="small" color="#000000" />
                    ) : isDownloaded ? (
                      <TouchableOpacity onPress={() => confirmDeleteModel(key, true)} style={{ paddingLeft: 12 }}>
                        <Text style={[styles.rowActionText, { color: "#ef4444" }]}>Remove</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => handleDownloadModel(key, true)} style={{ paddingLeft: 12 }}>
                        <Text style={styles.rowActionText}>Download</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.separator} />
                </View>
              );
            })}

            {/* Sign Out */}
            <TouchableOpacity style={styles.row} onPress={handleSignOut} activeOpacity={0.7}>
              <Text style={[styles.rowLabel, { color: "#ef4444" }]}>Sign Out</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>

      </SafeAreaView>

      {/* Add Tokens Drawer */}
      <Modal
        visible={showAddTokensDrawer}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddTokensDrawer(false)}
      >
        <TouchableOpacity 
          style={styles.drawerBackdrop} 
          activeOpacity={1} 
          onPress={() => setShowAddTokensDrawer(false)}
        >
          <View style={[styles.drawerContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 24 }]}>
            <TouchableOpacity activeOpacity={1} style={styles.drawerContent}>
              <Text style={styles.drawerTitle}>Add Tokens</Text>
              <Text style={styles.drawerSubtitle}>
                Get 3,000,000 tokens for ₹500 to activate team collaboration, real-time database sync, and AI features.
              </Text>

              <TouchableOpacity 
                style={styles.drawerPurchaseBtn} 
                onPress={handlePurchaseTokens}
                activeOpacity={0.8}
              >
                <Text style={styles.drawerPurchaseBtnText}>Add 3M Tokens (₹500)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.drawerCancelBtn} 
                onPress={() => setShowAddTokensDrawer(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.drawerCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  profileHeader: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 30,
  },
  profileInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  avatarPlaceholder: {
    backgroundColor: "#f4f4f5",
    justifyContent: "center",
    alignItems: "center",
  },
  profileHeaderNameContainer: {
    flex: 1,
    justifyContent: "center",
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000000",
    letterSpacing: -0.5,
  },
  profileUsername: {
    fontSize: 14,
    color: "#888888",
    marginTop: 2,
  },
  detailsCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  detailItem: {
    marginVertical: 4,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "600",
  },
  detailSeparator: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 6,
  },
  tokensValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#64748b",
    marginTop: 8,
  },
  settingsList: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 20,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
  },
  rowSublabel: {
    fontSize: 12,
    color: "#888888",
    marginTop: 4,
  },
  rowValue: {
    fontSize: 16,
    color: "#888888",
    fontWeight: "500",
    textTransform: "capitalize",
  },
  rowActionText: {
    fontSize: 16,
    color: "#000000",
    fontWeight: "700",
  },
  separator: {
    height: 1,
    backgroundColor: "#f1f5f9",
  },
  sectionHeaderContainer: {
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  manageTokensText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 8,
  },
  groupContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  groupLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  groupValue: {
    fontWeight: "800",
    color: "#6366f1",
  },
  groupSublabel: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  leaveGroupBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  leaveGroupBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ef4444",
  },
  groupActionsContainer: {
    flexDirection: "row",
    paddingVertical: 16,
  },
  groupActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  groupActionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  drawerContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  drawerContent: {
    alignItems: "center",
    width: "100%",
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 10,
  },
  drawerSubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  drawerPurchaseBtn: {
    width: "100%",
    backgroundColor: "#0f172a",
    paddingVertical: 16,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  drawerPurchaseBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  drawerCancelBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerCancelBtnText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "600",
  },
  radioContainer: {
    marginRight: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    justifyContent: "center",
    alignItems: "center",
  },
  radioOuterSelected: {
    borderColor: "#6366f1",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6366f1",
  },
  selectedModelRow: {
    backgroundColor: "#f8fafc",
  },
  subHeaderContainer: {
    paddingTop: 16,
    paddingBottom: 6,
  },
  subHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
