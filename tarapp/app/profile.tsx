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
  Image
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack, useFocusEffect } from "expo-router";
import { ResourceFetcher, SSDLITE_320_MOBILENET_V3_LARGE, CLIP_VIT_BASE_PATCH32_IMAGE } from "react-native-executorch";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import { getUserDb, initDb } from "../lib/db";
import { uploadFileToS3 } from "../lib/s3";
import * as FileSystemStore from "expo-file-system/legacy";
import { signOutGoogle, getCurrentUser, UserProfile } from "../lib/auth";

export const LFM_MODELS = {
  LFM2_5_350M_QUANTIZED: {
    id: "LFM2_5_350M_QUANTIZED",
    name: "Tar AI 350M Q",
    size: "454 MB",
    modelSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.8.0/lfm2.5-350M/xnnpack/lfm2_5_350m_xnnpack_8w4da.pte",
    tokenizerSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.8.0/lfm2.5-350M/tokenizer.json",
    tokenizerConfigSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.8.0/lfm2.5-350M/tokenizer_config.json"
  },
  LFM2_5_350M_FP16: {
    id: "LFM2_5_350M_FP16",
    name: "Tar AI 350M",
    size: "845 MB",
    modelSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.8.0/lfm2.5-350M/xnnpack/lfm2_5_350m_xnnpack_fp16.pte",
    tokenizerSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.8.0/lfm2.5-350M/tokenizer.json",
    tokenizerConfigSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5/resolve/v0.8.0/lfm2.5-350M/tokenizer_config.json"
  },
  LFM2_5_1_2B_INSTRUCT_QUANTIZED: {
    id: "LFM2_5_1_2B_INSTRUCT_QUANTIZED",
    name: "Tar AI 1.2B",
    size: "796 MB",
    modelSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm2.5-1.2B-instruct/resolve/v0.8.0/quantized/lfm2_5_1_2b_8da4w.pte",
    tokenizerSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm2.5-1.2B-instruct/resolve/v0.8.0/tokenizer.json",
    tokenizerConfigSource: "https://huggingface.co/software-mansion/react-native-executorch-lfm2.5-1.2B-instruct/resolve/v0.8.0/tokenizer_config.json"
  }
};

export const UTILITY_MODELS = {
  SSDLITE_DETECTOR: {
    id: "SSDLITE_DETECTOR",
    name: "Tar Vision SSDLite",
    size: "20 MB",
    modelSource: SSDLITE_320_MOBILENET_V3_LARGE.modelSource,
    description: "Locates candidate product objects in photos for matching."
  },
  YOLO26S_DETECTOR: {
    id: "YOLO26S_DETECTOR",
    name: "Tar Vision YOLO",
    size: "16 MB",
    modelSource: "https://huggingface.co/software-mansion/react-native-executorch-yolo26/resolve/v0.7.0/yolo26s/xnnpack/yolo26s.pte",
    description: "Real-time object detector model optimized with XNNPACK."
  },
  CLIP_MATCHER: {
    id: "CLIP_MATCHER",
    name: "Tar Vision CLIP",
    size: "87 MB",
    modelSource: CLIP_VIT_BASE_PATCH32_IMAGE.modelSource,
    description: "Extracts visual feature embeddings to match products."
  }
};

const SCOPES = [
  { category: "Personal", targetDb: "user_${self_id}.db", prefix: "p" },
  { category: "Global", targetDb: "global.db", prefix: "g" },
  { category: "Family", targetDb: "user_sync_${owner_id}.db", prefix: "f:{id}" },
  { category: "Team / Work", targetDb: "user_sync_${owner_id}.db", prefix: "t:{id}" },
  { category: "Friends", targetDb: "user_sync_${owner_id}.db", prefix: "r:{id}" },
  { category: "Storefront", targetDb: "user_sync_${owner_id}.db", prefix: "s:{id}" },
  { category: "Warehouse", targetDb: "user_sync_${owner_id}.db", prefix: "w:{id}" },
  { category: "Client / CRM", targetDb: "user_sync_${owner_id}.db", prefix: "c:{id}" },
  { category: "Campaigns", targetDb: "user_sync_${owner_id}.db", prefix: "m:{id}" },
  { category: "Forms", targetDb: "user_sync_${owner_id}.db", prefix: "x:{id}" },
  { category: "HR / Staff", targetDb: "user_sync_${owner_id}.db", prefix: "h:{id}" },
  { category: "Logistics", targetDb: "user_sync_${owner_id}.db", prefix: "d" }
];

const DUMMY_MEMBERS: Record<string, { name: string; role: string; photo: string }[]> = {
  "Personal": [
    { name: "You (Private Catalog)", role: "Owner", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Felix&backgroundColor=b6e3f4" }
  ],
  "Global": [
    { name: "System Admin", role: "Admin", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Admin&backgroundColor=c0aede" },
    { name: "Public Catalog Sync", role: "Automation", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Robot&backgroundColor=d1d4f9" }
  ],
  "Family": [
    { name: "Mom", role: "Admin", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Mom&backgroundColor=ffd5dc" },
    { name: "Sister", role: "Member", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Sister&backgroundColor=ffdf00" }
  ],
  "Team / Work": [
    { name: "Alice Smith", role: "Manager", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Alice&backgroundColor=c2f0c2" },
    { name: "Bob Johnson", role: "Lead Developer", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Bob&backgroundColor=ffe0b2" },
    { name: "Charlie Brown", role: "QA Engineer", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Charlie&backgroundColor=b6e3f4" }
  ],
  "Friends": [
    { name: "Dave Miller", role: "Member", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Dave&backgroundColor=c0aede" },
    { name: "Eva Green", role: "Member", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Eva&backgroundColor=ffd5dc" }
  ],
  "Storefront": [
    { name: "Central Retail Store", role: "Store", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Store&backgroundColor=d1d4f9" }
  ],
  "Warehouse": [
    { name: "Chennai SCM Warehouse", role: "Logistics", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Warehouse&backgroundColor=ffdf00" }
  ],
  "Client / CRM": [
    { name: "Acme Corp (VIP Lead)", role: "Client", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Client&backgroundColor=c2f0c2" },
    { name: "Wayne Enterprises", role: "Client", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Bruce&backgroundColor=ffe0b2" }
  ],
  "Campaigns": [
    { name: "Summer Launch Campaign", role: "Campaign", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Campaign&backgroundColor=b6e3f4" }
  ],
  "Forms": [
    { name: "Employee Feedback Form", role: "Form", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Form&backgroundColor=c0aede" }
  ],
  "HR / Staff": [
    { name: "HR Manager Office", role: "Admin", photo: "https://api.dicebear.com/7.x/notionists/png?seed=HR&backgroundColor=ffd5dc" }
  ],
  "Logistics": [
    { name: "Fleet Dispatcher", role: "Operations", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Dispatcher&backgroundColor=d1d4f9" },
    { name: "Delivery Partner 01", role: "Transit", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Delivery&backgroundColor=ffdf00" }
  ]
};

export default function ProfileScreen() {
  const router = useRouter();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string>("Never");
  const [tokens, setTokens] = useState<number>(0);

  const handlePurchaseTokens = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const addedTokens = 3000000;
      const finalTokens = tokens + addedTokens;
      
      setTokens(finalTokens);

      await SecureStore.setItemAsync("user_tokens", finalTokens.toString());
      await SecureStore.setItemAsync("user_pricing_plan", "Paid");

      Alert.alert(
        "Tokens Added",
        `Successfully added ${addedTokens.toLocaleString()} tokens.`,
        [{ text: "OK" }]
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not complete the purchase.");
    }
  };

  const promptAddTokens = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Add Tokens",
      "Purchase 3,000,000 tokens for ₹500 to enable sync and AI features?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Add (₹500)", onPress: handlePurchaseTokens }
      ]
    );
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

  const checkFilesStatus = useCallback(async () => {
    try {
      const files = await ResourceFetcher.listDownloadedFiles() as string[];
      const statusMap: Record<string, boolean> = {};
      
      for (const key of Object.keys(LFM_MODELS)) {
        const model = LFM_MODELS[key as keyof typeof LFM_MODELS];
        const modelFn = getFilenameFromUri(model.modelSource);
        const tokenizerFn = getFilenameFromUri(model.tokenizerSource);
        const hasModel = files.some((f: string) => f.endsWith(modelFn));
        const hasTokenizer = files.some((f: string) => f.endsWith(tokenizerFn));
        statusMap[key] = hasModel && hasTokenizer;
      }

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

  useFocusEffect(
    useCallback(() => {
      async function loadPreferences() {
        try {
          const user = await getCurrentUser();
          setUserProfile(user);

          const storedTime = await SecureStore.getItemAsync("private_db_last_backup_time");
          if (storedTime) {
            setLastBackupTime(storedTime);
          }

          const storedTokens = await SecureStore.getItemAsync("user_tokens");
          if (storedTokens !== null) {
            setTokens(parseInt(storedTokens, 10));
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

      try {
        await FileSystemStore.deleteAsync(localTempUri, { idempotent: true });
      } catch (_) {}

      await uDb.run("VACUUM INTO ?", [rawTempPath]);

      const result = await uploadFileToS3(
        localTempUri,
        "user.db",
        "application/x-sqlite3",
        false
      );

      await FileSystemStore.deleteAsync(localTempUri, { idempotent: true });

      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + 
                        ", " + new Date().toLocaleDateString([], { month: "short", day: "numeric" });
      setLastBackupTime(timestamp);
      await SecureStore.setItemAsync("private_db_last_backup_time", timestamp);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Backup Complete", `Database backed up successfully.\nPath: ${result.key}`);
    } catch (e: any) {
      console.error("Backup failed:", e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Backup Failed", e.message || "Unable to backup private database.");
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
              const currentUser = await getCurrentUser();
              if (currentUser) {
                await SecureStore.deleteItemAsync(`user_sync_url_${currentUser.id}`);
                await SecureStore.deleteItemAsync(`user_sync_token_${currentUser.id}`);
              }
              await signOutGoogle();
              await initDb();
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
        
        {/* Profile Info Header */}
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
                <Ionicons name="person" size={20} color="#71717a" />
              </View>
            )}
            <View style={styles.profileHeaderNameContainer}>
              <Text style={styles.profileName}>{userProfile?.name || "Guest User"}</Text>
              <Text style={styles.profileUsername}>{userProfile?.email || "@guest"}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.tokenRow}>
            <Text style={styles.tokensValue}>
              {tokens.toLocaleString()} Tokens
            </Text>
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={promptAddTokens}
              style={styles.addTokensButton}
            >
              <Text style={styles.manageTokensText}>Add Tokens</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.settingsList}>

            {/* Scope Codes Table / List */}
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionHeader}>Scope Mapping</Text>
            </View>
            
            <View style={styles.scopesListContainer}>
              {SCOPES.map((item, index) => {
                const members = DUMMY_MEMBERS[item.category] || [];
                return (
                  <View key={index} style={styles.scopeItemWrapper}>
                    <View style={styles.scopeHeaderRow}>
                      <View>
                        <Text style={styles.scopeCategoryName}>{item.category}</Text>
                        <Text style={styles.scopeDatabaseName}>{item.targetDb}</Text>
                      </View>
                      <View style={styles.scopePrefixBadge}>
                        <Text style={styles.scopePrefixText}>{item.prefix}</Text>
                      </View>
                    </View>

                    <View style={styles.membersContainer}>
                      {members.map((member, mIdx) => (
                        <View key={mIdx} style={styles.memberRow}>
                          <Image source={{ uri: member.photo }} style={styles.memberAvatar} />
                          <View style={styles.memberInfo}>
                            <Text style={styles.memberName}>{member.name}</Text>
                            <Text style={styles.memberRole}>{member.role}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Storage Settings */}
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionHeader}>Storage</Text>
            </View>

            <View style={styles.scopesListContainer}>
              <View style={styles.scopeItemWrapper}>
                <TouchableOpacity 
                  style={styles.scopeHeaderRow} 
                  onPress={handleBackupNow} 
                  disabled={isBackingUp}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <Image 
                      source={{ uri: "https://api.dicebear.com/7.x/notionists/png?seed=Database&backgroundColor=b6e3f4" }} 
                      style={styles.memberAvatar} 
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.scopeCategoryName}>Backup Database</Text>
                      <Text style={styles.scopeDatabaseName}>Last: {lastBackupTime}</Text>
                    </View>
                  </View>
                  {isBackingUp ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <View style={styles.scopePrefixBadge}>
                      <Text style={styles.scopePrefixText}>RUN NOW</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* AI Models */}
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionHeader}>AI Models</Text>
            </View>

            <View style={styles.subHeaderContainer}>
              <Text style={styles.subHeader}>Language</Text>
            </View>

            <View style={styles.scopesListContainer}>
              {Object.keys(LFM_MODELS).map((key) => {
                const model = LFM_MODELS[key as keyof typeof LFM_MODELS];
                const isSelected = activeModelId === key;
                const isDownloaded = downloadedModels[key];
                const isDownloading = downloadingModelId === key;

                let avatarUrl = "https://api.dicebear.com/7.x/notionists/png?seed=Brain&backgroundColor=c0aede";
                if (key === "LFM2_5_350M_QUANTIZED") {
                  avatarUrl = "https://api.dicebear.com/7.x/notionists/png?seed=Mind&backgroundColor=c0aede";
                } else if (key === "LFM2_5_350M_FP16") {
                  avatarUrl = "https://api.dicebear.com/7.x/notionists/png?seed=Brain&backgroundColor=d1d4f9";
                } else if (key === "LFM2_5_1_2B_INSTRUCT_QUANTIZED") {
                  avatarUrl = "https://api.dicebear.com/7.x/notionists/png?seed=Intellect&backgroundColor=ffd5dc";
                }

                return (
                  <View key={key} style={styles.scopeItemWrapper}>
                    <TouchableOpacity 
                      style={styles.scopeHeaderRow}
                      onPress={() => handleSelectModel(key)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                        <Image source={{ uri: avatarUrl }} style={styles.memberAvatar} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.scopeCategoryName, isSelected && { fontWeight: "800" }]}>
                            {model.name} {isSelected && "• Active"}
                          </Text>
                          <Text style={styles.scopeDatabaseName}>
                            {isDownloading 
                              ? `Downloading ${downloadProgress}%` 
                              : isDownloaded 
                                ? "Ready on device" 
                                : `Offline • ${model.size}`}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        {isDownloading ? (
                          <ActivityIndicator size="small" color="#000000" />
                        ) : isDownloaded ? (
                          <TouchableOpacity 
                            onPress={() => confirmDeleteModel(key, false)}
                            style={[styles.scopePrefixBadge, { backgroundColor: "#fee2e2" }]}
                          >
                            <Text style={[styles.scopePrefixText, { color: "#ef4444" }]}>REMOVE</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity 
                            onPress={() => handleDownloadModel(key, false)}
                            style={styles.scopePrefixBadge}
                          >
                            <Text style={styles.scopePrefixText}>GET</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <View style={styles.subHeaderContainer}>
              <Text style={styles.subHeader}>Vision</Text>
            </View>

            <View style={styles.scopesListContainer}>
              {Object.keys(UTILITY_MODELS).map((key) => {
                const model = UTILITY_MODELS[key as keyof typeof UTILITY_MODELS];
                const isDownloaded = downloadedModels[key];
                const isDownloading = downloadingModelId === key;

                let avatarUrl = "https://api.dicebear.com/7.x/notionists/png?seed=Camera&backgroundColor=ffe0b2";
                if (key === "SSDLITE_DETECTOR") {
                  avatarUrl = "https://api.dicebear.com/7.x/notionists/png?seed=Eye&backgroundColor=ffdf00";
                } else if (key === "YOLO26S_DETECTOR") {
                  avatarUrl = "https://api.dicebear.com/7.x/notionists/png?seed=Vision&backgroundColor=c2f0c2";
                } else if (key === "CLIP_MATCHER") {
                  avatarUrl = "https://api.dicebear.com/7.x/notionists/png?seed=Snap&backgroundColor=ffe0b2";
                }

                return (
                  <View key={key} style={styles.scopeItemWrapper}>
                    <View style={styles.scopeHeaderRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                        <Image source={{ uri: avatarUrl }} style={styles.memberAvatar} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.scopeCategoryName}>{model.name}</Text>
                          <Text style={styles.scopeDatabaseName}>
                            {isDownloading 
                              ? `Downloading ${downloadProgress}%` 
                              : isDownloaded 
                                ? `Ready • ${model.size}` 
                                : `Offline • ${model.size}`}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        {isDownloading ? (
                          <ActivityIndicator size="small" color="#000000" />
                        ) : isDownloaded ? (
                          <TouchableOpacity 
                            onPress={() => confirmDeleteModel(key, true)}
                            style={[styles.scopePrefixBadge, { backgroundColor: "#fee2e2" }]}
                          >
                            <Text style={[styles.scopePrefixText, { color: "#ef4444" }]}>REMOVE</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity 
                            onPress={() => handleDownloadModel(key, true)}
                            style={styles.scopePrefixBadge}
                          >
                            <Text style={styles.scopePrefixText}>GET</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Sign Out */}
            <View style={styles.scopesListContainer}>
              <View style={[styles.scopeItemWrapper, { borderBottomWidth: 0 }]}>
                <TouchableOpacity 
                  style={styles.scopeHeaderRow} 
                  onPress={handleSignOut} 
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <Image 
                      source={{ uri: "https://api.dicebear.com/7.x/notionists/png?seed=Exit&backgroundColor=ffd5dc" }} 
                      style={styles.memberAvatar} 
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.scopeCategoryName, { color: "#ef4444" }]}>Sign Out</Text>
                      <Text style={styles.scopeDatabaseName}>Exit current session</Text>
                    </View>
                  </View>
                  <View style={[styles.scopePrefixBadge, { backgroundColor: "#fee2e2" }]}>
                    <Text style={[styles.scopePrefixText, { color: "#ef4444" }]}>EXIT</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

          </View>
        </ScrollView>

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
  profileHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  profileInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
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
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  profileUsername: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 1,
  },
  tokenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tokensValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  addTokensButton: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  manageTokensText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  settingsList: {
    paddingBottom: 40,
  },
  sectionHeaderContainer: {
    paddingTop: 24,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  subHeaderContainer: {
    paddingTop: 14,
    paddingBottom: 6,
    paddingHorizontal: 20,
  },
  subHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  // Full-width Scopes list (no outer borders, no rounded corners)
  scopesListContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  scopeItemWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  scopeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  scopeCategoryName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  scopeDatabaseName: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  scopePrefixBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  scopePrefixText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "700",
  },
  membersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  memberRole: {
    fontSize: 11,
    color: "#64748b",
  },
});
