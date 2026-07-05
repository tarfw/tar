import { useState, useEffect } from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { useThemeMode } from "@/hooks/use-theme-context";
import { useTheme } from "@/hooks/use-theme";
import { getCurrentUser, signOutGoogle, type UserProfile } from "@/lib/auth";
import { useEmbeddings } from "@/db/embeddings-provider";

import {
  Text,
  Button,
  Switch,
  Row,
  Column,
  ListItem,
  Card,
  HorizontalDivider,
} from "@expo/ui/jetpack-compose";

export default function SettingsScreen() {
  const router = useRouter();
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
    <Column style={styles.container}>
      {/* AI Models */}
      <Text style={styles.sectionTitle}>AI MODELS</Text>
      <Card style={styles.card}>
        <Row alignment="center" style={styles.row}>
          <Text style={styles.label}>Embedding (350M)</Text>
          <Row alignment="center" style={{ gap: 8 }}>
            {isReady && (
              <>
                <Text style={styles.valueGreen}>Ready</Text>
                <Button label="Clear" variant="text" onPress={clearModel} />
              </>
            )}
            {isLoading && (
              <Text style={styles.value}>{Math.round(downloadProgress * 100)}%</Text>
            )}
            {error && (
              <Text style={styles.valueRed}>Failed</Text>
            )}
            {!isReady && !isLoading && !error && (
              <Button label="Download" variant="filled" onPress={loadModel} />
            )}
          </Row>
        </Row>
        <HorizontalDivider />
        <Row alignment="center" style={styles.row}>
          <Text style={styles.label}>Model Info</Text>
          <Text style={styles.value}>384-dim • Cosine • MiniLM</Text>
        </Row>
      </Card>

      {/* Appearance */}
      <Text style={styles.sectionTitle}>APPEARANCE</Text>
      <Card style={styles.card}>
        <ListItem onPress={() => setThemeMode(themeMode === "light" ? "dark" : "light")}>
          <Text style={styles.label}>Theme</Text>
          <Text style={styles.value}>{themeMode === "light" ? "Light" : "Dark"}</Text>
        </ListItem>
      </Card>

      {/* Notifications */}
      <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
      <Card style={styles.card}>
        <Row alignment="center" style={styles.row}>
          <Text style={styles.label}>Push Notifications</Text>
          <Switch value={notifications} onValueChange={setNotifications} />
        </Row>
      </Card>

      {/* General */}
      <Text style={styles.sectionTitle}>GENERAL</Text>
      <Card style={styles.card}>
        <ListItem onPress={() => router.push("/actions-catalog" as any)}>
          <Text style={styles.label}>Actions</Text>
        </ListItem>
        <HorizontalDivider />
        <Row alignment="center" style={styles.row}>
          <Text style={styles.label}>Language</Text>
          <Text style={styles.value}>English</Text>
        </Row>
        <HorizontalDivider />
        <Row alignment="center" style={styles.row}>
          <Text style={styles.label}>Region</Text>
          <Text style={styles.value}>India</Text>
        </Row>
      </Card>

      {/* About */}
      <Text style={styles.sectionTitle}>ABOUT</Text>
      <Card style={styles.card}>
        <Row alignment="center" style={styles.row}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>1.0.0</Text>
        </Row>
        <HorizontalDivider />
        <Row alignment="center" style={styles.row}>
          <Text style={styles.label}>Privacy Policy</Text>
        </Row>
        <HorizontalDivider />
        <Row alignment="center" style={styles.row}>
          <Text style={styles.label}>Terms of Service</Text>
        </Row>
      </Card>

      {/* Account */}
      <Text style={styles.sectionTitle}>ACCOUNT</Text>
      <Card style={styles.card}>
        {user?.name && (
          <>
            <Row alignment="center" style={styles.row}>
              <Text style={styles.label}>{user.name}</Text>
            </Row>
            <HorizontalDivider />
          </>
        )}
        {user?.email && (
          <>
            <Row alignment="center" style={styles.row}>
              <Text style={styles.value}>{user.email}</Text>
            </Row>
            <HorizontalDivider />
          </>
        )}
        <ListItem onPress={handleSignOut}>
          <Text style={styles.labelRed}>Sign Out</Text>
        </ListItem>
      </Card>
    </Column>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 12,
  },
  row: {
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: {
    fontSize: 16,
    color: "#fff",
  },
  value: {
    fontSize: 16,
    color: "#888",
  },
  valueGreen: {
    fontSize: 14,
    color: "#34C759",
    fontWeight: "500",
  },
  valueRed: {
    fontSize: 14,
    color: "#FF3B30",
  },
  labelRed: {
    fontSize: 16,
    color: "#FF3B30",
  },
});
