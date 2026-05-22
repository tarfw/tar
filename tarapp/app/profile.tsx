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

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [backupFreq, setBackupFreq] = useState<"daily" | "weekly">("daily");
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string>("Never");

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
