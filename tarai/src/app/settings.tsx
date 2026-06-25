import { useState, useEffect } from "react";
import {
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  View,
  Text,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeMode } from "@/hooks/use-theme-context";
import { useTheme } from "@/hooks/use-theme";
import { getCurrentUser, signOutGoogle, type UserProfile } from "@/lib/auth";
import { useEmbeddings } from "@/db/embeddings-provider";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { themeMode, setThemeMode } = useThemeMode();
  const { isReady, isLoading, downloadProgress, error, loadModel, clearModel } =
    useEmbeddings();
  const [notifications, setNotifications] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOutGoogle();
      router.replace("/auth");
    } catch {
      router.replace("/auth");
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 20,
      }}
    >
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        AI MODELS
      </Text>
      <View
        style={[styles.section, { backgroundColor: theme.backgroundElement }]}
      >
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>
            Embedding (350M)
          </Text>
          <View style={styles.rowRight}>
            {isReady && (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Text
                  style={{ color: "#34C759", fontSize: 13, fontWeight: "500" }}
                >
                  Ready
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.downloadBtn,
                    { backgroundColor: theme.background },
                    pressed && { opacity: 0.6 },
                  ]}
                  onPress={() => {
                    console.log("[SETTINGS] Clear button pressed");
                    clearModel();
                  }}
                >
                  <Text
                    style={{
                      color: "#FF3B30",
                      fontSize: 13,
                      fontWeight: "500",
                    }}
                  >
                    Clear
                  </Text>
                </Pressable>
              </View>
            )}
            {isLoading && (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(downloadProgress * 100)}%` },
                    ]}
                  />
                </View>
                <Text
                  style={{
                    color: theme.textSecondary,
                    fontSize: 12,
                    minWidth: 32,
                    textAlign: "right",
                  }}
                >
                  {Math.round(downloadProgress * 100)}%
                </Text>
              </View>
            )}
            {error && (
              <Text style={{ color: "#FF3B30", fontSize: 13 }}>Failed</Text>
            )}
            {!isReady && !isLoading && !error && (
              <Pressable
                style={({ pressed }) => [
                  styles.downloadBtn,
                  { backgroundColor: theme.background },
                  pressed && { opacity: 0.6 },
                ]}
                onPress={() => {
                  console.log(
                    "[SETTINGS] Download button pressed — calling loadModel()",
                  );
                  loadModel();
                }}
              >
                <Text
                  style={{ color: theme.text, fontSize: 13, fontWeight: "500" }}
                >
                  Download
                </Text>
              </Pressable>
            )}
          </View>
        </View>
        <View
          style={[styles.separator, { backgroundColor: theme.background }]}
        />
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>
            Model Info
          </Text>
          <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
            384-dim • Cosine • MiniLM
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        APPEARANCE
      </Text>
      <View
        style={[styles.section, { backgroundColor: theme.backgroundElement }]}
      >
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
          onPress={() => setThemeMode(themeMode === "light" ? "dark" : "light")}
        >
          <Text style={[styles.rowLabel, { color: theme.text }]}>Theme</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons
              name={themeMode === "light" ? "sunny" : "moon"}
              size={20}
              color={themeMode === "light" ? "#FFB800" : "#8B5CF6"}
            />
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
              {themeMode === "light" ? "Light" : "Dark"}
            </Text>
          </View>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        NOTIFICATIONS
      </Text>
      <View
        style={[styles.section, { backgroundColor: theme.backgroundElement }]}
      >
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>
            Push Notifications
          </Text>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: "#E9E9EA", true: "#34C759" }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        GENERAL
      </Text>
      <View
        style={[styles.section, { backgroundColor: theme.backgroundElement }]}
      >
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
          onPress={() => router.push("/actions-catalog" as any)}
        >
          <Text style={[styles.rowLabel, { color: theme.text }]}>Actions</Text>
          <Text style={[styles.chevron, { color: theme.textSecondary }]}>
            {">"}
          </Text>
        </Pressable>
        <View
          style={[styles.separator, { backgroundColor: theme.background }]}
        />
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Language</Text>
          <View style={styles.rowRight}>
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
              English
            </Text>
          </View>
        </View>
        <View
          style={[styles.separator, { backgroundColor: theme.background }]}
        />
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Region</Text>
          <View style={styles.rowRight}>
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
              United States
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        ABOUT
      </Text>
      <View
        style={[styles.section, { backgroundColor: theme.backgroundElement }]}
      >
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Version</Text>
          <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
            1.0.0
          </Text>
        </View>
        <View
          style={[styles.separator, { backgroundColor: theme.background }]}
        />
        <Pressable style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>
            Privacy Policy
          </Text>
          <Text style={[styles.chevron, { color: theme.textSecondary }]}>
            {">"}
          </Text>
        </Pressable>
        <View
          style={[styles.separator, { backgroundColor: theme.background }]}
        />
        <Pressable style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>
            Terms of Service
          </Text>
          <Text style={[styles.chevron, { color: theme.textSecondary }]}>
            {">"}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        ACCOUNT
      </Text>
      <View
        style={[styles.section, { backgroundColor: theme.backgroundElement }]}
      >
        {user?.name && (
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>
              {user.name}
            </Text>
          </View>
        )}
        {user?.email && (
          <>
            <View
              style={[styles.separator, { backgroundColor: theme.background }]}
            />
            <View style={styles.row}>
              <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
                {user.email}
              </Text>
            </View>
          </>
        )}
        <View
          style={[styles.separator, { backgroundColor: theme.background }]}
        />
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
          onPress={handleSignOut}
        >
          <Text style={[styles.rowLabel, { color: "#FF3B30" }]}>Sign Out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "400",
    marginTop: 28,
    marginBottom: 8,
    marginLeft: 30,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  section: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 44,
  },
  rowLabel: {
    fontSize: 17,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowValue: {
    fontSize: 17,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  chevron: {
    fontSize: 16,
    fontWeight: "600",
  },
  downloadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  progressTrack: {
    width: 60,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E5EA",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#007AFF",
  },
});
