import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import { getUserDb } from "../lib/db";
import * as FileSystem from "expo-file-system/legacy";


export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [backupFreq, setBackupFreq] = useState<"daily" | "weekly">("daily");
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string>("Never");

  const [whisperStatus, setWhisperStatus] = useState<"not_downloaded" | "downloading" | "ready">("not_downloaded");
  const [whisperProgress, setWhisperProgress] = useState(0);

  const [clipStatus, setClipStatus] = useState<"not_downloaded" | "downloading" | "ready">("not_downloaded");
  const [clipProgress, setClipProgress] = useState(0);

  const modelsDir = `${FileSystem.documentDirectory}models/`;
  const whisperUrl = "https://pub-db115456f9664f3fb02096f42fb6435a.r2.dev/whisper_tiny_en.pte";
  const yoloUrl = "https://pub-db115456f9664f3fb02096f42fb6435a.r2.dev/yolo26n.pte";
  const clipUrl = "https://pub-db115456f9664f3fb02096f42fb6435a.r2.dev/clip_image_int8.pte";

  // Check downloaded model files status
  useEffect(() => {
    async function checkFiles() {
      try {
        const whisperInfo = await FileSystem.getInfoAsync(modelsDir + "whisper_tiny_en.pte");
        if (whisperInfo.exists) {
          setWhisperStatus("ready");
        }
        
        const yoloInfo = await FileSystem.getInfoAsync(modelsDir + "yolo26n.pte");
        const clipInfo = await FileSystem.getInfoAsync(modelsDir + "clip_image_int8.pte");
        if (yoloInfo.exists && clipInfo.exists) {
          setClipStatus("ready");
        }
      } catch (e) {
        console.error("Error checking model files:", e);
      }
    }
    checkFiles();
  }, []);


  const ensureDirectoryExists = async () => {
    const dirInfo = await FileSystem.getInfoAsync(modelsDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(modelsDir, { intermediates: true });
    }
  };

  const handleWhisperAction = async () => {
    if (whisperStatus === "ready") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Alert.alert(
      "Download Voice Model",
      "Do you want to download the Offline Voice Dictation model? This file is 151 MB.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Download", 
          onPress: async () => {
            try {
              setWhisperStatus("downloading");
              setWhisperProgress(0);
              await ensureDirectoryExists();

              const localUri = modelsDir + "whisper_tiny_en.pte";
              const downloadResumable = FileSystem.createDownloadResumable(
                whisperUrl,
                localUri,
                {},
                (downloadProgress) => {
                  const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                  setWhisperProgress(Math.round(progress * 100));
                }
              );

              await downloadResumable.downloadAsync();
              setWhisperStatus("ready");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Success", "Offline Voice Dictation model downloaded and ready.");
            } catch (err) {
              console.error("Whisper download failed:", err);
              setWhisperStatus("not_downloaded");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Error", "Failed to download model file.");
            }
          }
        }
      ]
    );
  };

  const handleClipAction = async () => {
    if (clipStatus === "ready") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Alert.alert(
      "Download Photo Model Pack",
      "Do you want to download the Photo Product Matching models? This includes the YOLO26N detector and CLIP matcher (total size: ~107 MB).",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Download", 
          onPress: async () => {
            try {
              setClipStatus("downloading");
              setClipProgress(0);
              await ensureDirectoryExists();

              // Step 1: Download YOLO26N (10.3 MB)
              const yoloLocalUri = modelsDir + "yolo26n.pte";
              const yoloDownloader = FileSystem.createDownloadResumable(
                yoloUrl,
                yoloLocalUri,
                {},
                (downloadProgress) => {
                  const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                  // Map YOLO to 0% - 10% of total visual feedback progress
                  setClipProgress(Math.round(progress * 10));
                }
              );
              await yoloDownloader.downloadAsync();

              // Step 2: Download CLIP (96.4 MB)
              const clipLocalUri = modelsDir + "clip_image_int8.pte";
              const clipDownloader = FileSystem.createDownloadResumable(
                clipUrl,
                clipLocalUri,
                {},
                (downloadProgress) => {
                  const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                  // Map CLIP to 10% - 100% of progress
                  setClipProgress(10 + Math.round(progress * 90));
                }
              );
              await clipDownloader.downloadAsync();

              setClipStatus("ready");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Success", "Photo Product Matching models downloaded and ready.");
            } catch (err) {
              console.error("CLIP/YOLO download failed:", err);
              setClipStatus("not_downloaded");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Error", "Failed to download model files.");
            }
          }
        }
      ]
    );
  };

  const confirmDeleteModel = (modelType: "whisper" | "clip") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const modelName = modelType === "whisper" ? "Offline Voice Dictation" : "Photo Product Matching";

    Alert.alert(
      "Remove Model",
      `Are you sure you want to delete the ${modelName} model file(s) from your device?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              if (modelType === "whisper") {
                await FileSystem.deleteAsync(modelsDir + "whisper_tiny_en.pte", { idempotent: true });
                setWhisperStatus("not_downloaded");
              } else {
                await FileSystem.deleteAsync(modelsDir + "yolo26n.pte", { idempotent: true });
                await FileSystem.deleteAsync(modelsDir + "clip_image_int8.pte", { idempotent: true });
                setClipStatus("not_downloaded");
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Removed", "Model file(s) deleted to free up space.");
            } catch (e) {
              console.error("Error deleting model file:", e);
              Alert.alert("Error", "Failed to delete model file.");
            }
          }
        }
      ]
    );
  };



  // Load preferences
  useEffect(() => {
    async function loadPreferences() {
      try {
        const storedFreq = await SecureStore.getItemAsync("private_db_backup_frequency");
        if (storedFreq === "weekly" || storedFreq === "daily") {
          setBackupFreq(storedFreq);
        }

        const storedTime = await SecureStore.getItemAsync("private_db_last_backup_time");
        if (storedTime) {
          setLastBackupTime(storedTime);
        }
      } catch (e) {
        console.error("Failed to load secure settings:", e);
      }
    }
    loadPreferences();
  }, []);

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
      await uDb.push();
      
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + 
                        ", " + new Date().toLocaleDateString([], { month: "short", day: "numeric" });
      setLastBackupTime(timestamp);
      await SecureStore.setItemAsync("private_db_last_backup_time", timestamp);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Backup", "Private database backup completed.");
    } catch (e) {
      console.error("Backup failed:", e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Backup Failed", "Unable to sync private database.");
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
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.replace("/");
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        
        {/* User Card - Tapping acts as a back gesture */}
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.profileHeader}
        >
          <Text style={styles.profileName}>prabha</Text>
          <Text style={styles.profileUsername}>@prabha</Text>
          <Text style={styles.tokensValue}>1,000,000 Tokens</Text>
        </TouchableOpacity>

        {/* Settings List */}
        <View style={styles.settingsList}>
          
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

          {/* Offline Voice Model Downloader */}
          <TouchableOpacity 
            style={styles.row} 
            onPress={handleWhisperAction} 
            disabled={whisperStatus === "downloading"}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.rowLabel}>Offline Voice Dictation</Text>
              <Text style={styles.rowSublabel}>
                {whisperStatus === "ready" 
                  ? "Model is downloaded and ready (151 MB)" 
                  : whisperStatus === "downloading" 
                    ? `Downloading model... ${whisperProgress}%` 
                    : "Tap to download offline speech-to-text (~151 MB)"}
              </Text>
            </View>
            {whisperStatus === "downloading" ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : whisperStatus === "ready" ? (
              <TouchableOpacity onPress={() => confirmDeleteModel("whisper")}>
                <Text style={[styles.rowActionText, { color: "#ef4444" }]}>Remove</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.rowActionText}>Download</Text>
            )}
          </TouchableOpacity>

          <View style={styles.separator} />

          {/* Offline Photo Matching Model Downloader */}
          <TouchableOpacity 
            style={styles.row} 
            onPress={handleClipAction} 
            disabled={clipStatus === "downloading"}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.rowLabel}>Photo Product Matching</Text>
              <Text style={styles.rowSublabel}>
                {clipStatus === "ready" 
                  ? "Models are downloaded and ready (107 MB)" 
                  : clipStatus === "downloading" 
                    ? `Downloading models... ${clipProgress}%` 
                    : "Tap to download detector & match modules (~107 MB)"}
              </Text>
            </View>
            {clipStatus === "downloading" ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : clipStatus === "ready" ? (
              <TouchableOpacity onPress={() => confirmDeleteModel("clip")}>
                <Text style={[styles.rowActionText, { color: "#ef4444" }]}>Remove</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.rowActionText}>Download</Text>
            )}
          </TouchableOpacity>



          {/* Sign Out */}
          <TouchableOpacity style={styles.row} onPress={handleSignOut} activeOpacity={0.7}>
            <Text style={[styles.rowLabel, { color: "#ef4444" }]}>Sign Out</Text>
          </TouchableOpacity>

        </View>

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
    paddingTop: 40,
    paddingBottom: 40,
  },
  profileName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#000000",
    letterSpacing: -1,
  },
  profileUsername: {
    fontSize: 14,
    color: "#888888",
    marginTop: 4,
  },
  tokensValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#64748b",
    marginTop: 8,
  },
  settingsList: {
    paddingHorizontal: 20,
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
});
