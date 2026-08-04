import { useState, useEffect } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeMode } from "@/hooks/use-theme-context";
import { useTheme } from "@/hooks/use-theme";
import { getCurrentUser, signOutGoogle, type UserProfile } from "@/lib/auth";
import { useEmbeddings } from "@/db/embeddings-provider";
import { useLLM, models } from "react-native-executorch";
import { isHammerCached, isLfmCached } from "@/lib/hammer";

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { themeMode, setThemeMode } = useThemeMode();
  const { isReady, isLoading, downloadProgress, loadModel } = useEmbeddings();
  const [user, setUser] = useState<UserProfile | null>(null);

  // Hammer LLM state
  const [isHammerCachedState, setIsHammerCachedState] = useState(false);
  const [preventHammerLoad, setPreventHammerLoad] = useState(true);

  // LFM LLM state
  const [isLfmCachedState, setIsLfmCachedState] = useState(false);
  const [preventLfmLoad, setPreventLfmLoad] = useState(true);

  useEffect(() => {
    getCurrentUser().then(setUser);
    isHammerCached().then(setIsHammerCachedState);
    isLfmCached().then(setIsLfmCachedState);
  }, []);

  const hammerLlm = useLLM({
    model: models.llm.hammer2_1_0_5b(),
    preventLoad: preventHammerLoad,
  });

  const lfmLlm = useLLM({
    model: models.llm.lfm2_5_1_2b_instruct(),
    preventLoad: preventLfmLoad,
  });

  const isHammerLoading =
    !hammerLlm.isReady &&
    !hammerLlm.error &&
    !preventHammerLoad &&
    hammerLlm.downloadProgress < 1;

  const isLfmLoading =
    !lfmLlm.isReady &&
    !lfmLlm.error &&
    !preventLfmLoad &&
    lfmLlm.downloadProgress < 1;

  useEffect(() => {
    if (hammerLlm.isReady) {
      setIsHammerCachedState(true);
    }
  }, [hammerLlm.isReady]);

  useEffect(() => {
    if (lfmLlm.isReady) {
      setIsLfmCachedState(true);
    }
  }, [lfmLlm.isReady]);

  const handleLoadHammer = () => {
    setPreventHammerLoad(false);
  };

  const handleLoadLfm = () => {
    setPreventLfmLoad(false);
  };

  const handleSignOut = async () => {
    try {
      if (user?.id) {
        await SecureStore.deleteItemAsync(`onb_${user.id}`);
      }
      await signOutGoogle();
      const { switchUser } = await import("@/lib/db");
      await switchUser("guest");
      router.replace("/auth");
    } catch {
      router.replace("/auth");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 4 }}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 16 }}
      >
      
      {/* Section 1: Appearance */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        APPEARANCE
      </Text>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => setThemeMode(themeMode === "light" ? "dark" : "light")}>
          <View style={styles.rowLeftWithIcon}>
            <Ionicons
              name={themeMode === "light" ? "sunny-outline" : "moon-outline"}
              size={20}
              color={themeMode === "light" ? "#FFB800" : "#8B5CF6"}
              style={styles.rowIcon}
            />
            <Text style={[styles.rowTitle, { color: theme.text }]}>Theme Mode</Text>
          </View>
          <View style={styles.rowRightContainer}>
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
              {themeMode === "light" ? "Light" : "Dark"}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} style={{ marginLeft: 6 }} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Section 2: AI Models & Local Engine */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        AI MODELS & ENGINE
      </Text>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>Embedding Model</Text>
            <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>384-dim • MiniLM</Text>
          </View>
          <View style={styles.rowRight}>
            {isReady ? (
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>Ready</Text>
            ) : isLoading ? (
              <Text style={[styles.statusText, { color: theme.primary }]}>
                {Math.round(downloadProgress * 100)}%
              </Text>
            ) : (
              <TouchableOpacity
                style={[styles.downloadButton, { backgroundColor: theme.primary }]}
                activeOpacity={0.8}
                onPress={loadModel}>
                <Text style={styles.downloadButtonText}>Download</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>Hammer LLM</Text>
            <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>0.5B • Quantized</Text>
          </View>
          <View style={styles.rowRight}>
            {hammerLlm.isReady ? (
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>Ready</Text>
            ) : isHammerLoading ? (
              <Text style={[styles.statusText, { color: theme.primary }]}>
                {Math.round(hammerLlm.downloadProgress * 100)}%
              </Text>
            ) : isHammerCachedState ? (
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>Cached</Text>
            ) : (
              <TouchableOpacity
                style={[styles.downloadButton, { backgroundColor: theme.primary }]}
                activeOpacity={0.8}
                onPress={handleLoadHammer}>
                <Text style={styles.downloadButtonText}>Download</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>LFM 2.5 LLM</Text>
            <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>1.2B • Instruct</Text>
          </View>
          <View style={styles.rowRight}>
            {lfmLlm.isReady ? (
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>Ready</Text>
            ) : isLfmLoading ? (
              <Text style={[styles.statusText, { color: theme.primary }]}>
                {Math.round(lfmLlm.downloadProgress * 100)}%
              </Text>
            ) : isLfmCachedState ? (
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>Cached</Text>
            ) : (
              <TouchableOpacity
                style={[styles.downloadButton, { backgroundColor: theme.primary }]}
                activeOpacity={0.8}
                onPress={handleLoadLfm}>
                <Text style={styles.downloadButtonText}>Download</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => router.push("/chat")}>
          <View style={styles.rowLeftWithIcon}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.primary} style={styles.rowIcon} />
            <Text style={[styles.rowTitle, { color: theme.text }]}>Open AI Chat</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Section 3: Account */}
      {user && (
        <>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            ACCOUNT
          </Text>

          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{user.name || "User"}</Text>
                {user.email && (
                  <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>{user.email}</Text>
                )}
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={handleSignOut}>
              <View style={styles.rowLeftWithIcon}>
                <Ionicons name="log-out-outline" size={20} color="#FF3B30" style={styles.rowIcon} />
                <Text style={[styles.rowTitle, { color: "#FF3B30" }]}>Sign Out</Text>
              </View>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Footer */}
      <Text style={[styles.footerText, { color: theme.textSecondary }]}>
        Version 1.0.0
      </Text>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
    paddingLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  rowLeft: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  rowLeftWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  rowValue: {
    fontSize: 15,
  },
  rowRight: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rowRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '500',
  },
  downloadButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    width: '100%',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 48,
  },
});
