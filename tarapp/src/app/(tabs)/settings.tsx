import { useState, useEffect } from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { useThemeMode } from "@/hooks/use-theme-context";
import { useTheme } from "@/hooks/use-theme";
import { getCurrentUser, signOutGoogle, type UserProfile } from "@/lib/auth";
import { useEmbeddings } from "@/db/embeddings-provider";

import {
  Host,
  FieldGroup,
  Switch,
  Text,
  Button,
  Row,
  ListItem,
} from "@expo/ui";

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
    <Host style={{ flex: 1, backgroundColor: theme.background }} useViewportSizeMeasurement>
      <FieldGroup style={styles.container}>

        {/* AI Models */}
        <FieldGroup.Section title="AI Models" titleUppercase>
          <Row alignment="center" style={styles.row}>
            <Text style={{ color: theme.text, fontSize: 17 }}>Embedding (350M)</Text>
            <Row alignment="center" style={{ gap: 8 }}>
              {isReady && (
                <>
                  <Text style={{ color: "#34C759", fontSize: 13, fontWeight: "500" }}>Ready</Text>
                  <Button label="Clear" variant="text" onPress={clearModel} />
                </>
              )}
              {isLoading && (
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                  {Math.round(downloadProgress * 100)}%
                </Text>
              )}
              {error && (
                <Text style={{ color: "#FF3B30", fontSize: 13 }}>Failed</Text>
              )}
              {!isReady && !isLoading && !error && (
                <Button label="Download" variant="filled" onPress={loadModel} />
              )}
            </Row>
          </Row>
          <Row alignment="center" style={styles.row}>
            <Text style={{ color: theme.text, fontSize: 17 }}>Model Info</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 17 }}>
              384-dim  Cosine  MiniLM
            </Text>
          </Row>
        </FieldGroup.Section>

        {/* Appearance */}
        <FieldGroup.Section title="Appearance" titleUppercase>
          <ListItem
            onPress={() => setThemeMode(themeMode === "light" ? "dark" : "light")}
          >
            <Text style={{ color: theme.text, fontSize: 17 }}>Theme</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 17 }}>
              {themeMode === "light" ? "Light" : "Dark"}
            </Text>
          </ListItem>
        </FieldGroup.Section>

        {/* Notifications */}
        <FieldGroup.Section title="Notifications" titleUppercase>
          <Row alignment="center" style={styles.row}>
            <Text style={{ color: theme.text, fontSize: 17 }}>Push Notifications</Text>
            <Switch value={notifications} onValueChange={setNotifications} />
          </Row>
        </FieldGroup.Section>

        {/* General */}
        <FieldGroup.Section title="General" titleUppercase>
          <ListItem onPress={() => router.push("/actions-catalog" as any)}>
            <Text style={{ color: theme.text, fontSize: 17 }}>Actions</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 17 }}>{">"}</Text>
          </ListItem>
          <Row alignment="center" style={styles.row}>
            <Text style={{ color: theme.text, fontSize: 17 }}>Language</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 17 }}>English</Text>
          </Row>
          <Row alignment="center" style={styles.row}>
            <Text style={{ color: theme.text, fontSize: 17 }}>Region</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 17 }}>India</Text>
          </Row>
        </FieldGroup.Section>

        {/* About */}
        <FieldGroup.Section title="About" titleUppercase>
          <Row alignment="center" style={styles.row}>
            <Text style={{ color: theme.text, fontSize: 17 }}>Version</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 17 }}>1.0.0</Text>
          </Row>
          <Row alignment="center" style={styles.row}>
            <Text style={{ color: theme.text, fontSize: 17 }}>Privacy Policy</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 17 }}>{">"}</Text>
          </Row>
          <Row alignment="center" style={styles.row}>
            <Text style={{ color: theme.text, fontSize: 17 }}>Terms of Service</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 17 }}>{">"}</Text>
          </Row>
        </FieldGroup.Section>

        {/* Account */}
        <FieldGroup.Section title="Account" titleUppercase>
          {user?.name && (
            <Row alignment="center" style={styles.row}>
              <Text style={{ color: theme.text, fontSize: 17 }}>{user.name}</Text>
            </Row>
          )}
          {user?.email && (
            <Row alignment="center" style={styles.row}>
              <Text style={{ color: theme.textSecondary, fontSize: 17 }}>{user.email}</Text>
            </Row>
          )}
          <ListItem onPress={handleSignOut}>
            <Text style={{ color: "#FF3B30", fontSize: 17 }}>Sign Out</Text>
          </ListItem>
        </FieldGroup.Section>

      </FieldGroup>
    </Host>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    justifyContent: "space-between",
    minHeight: 44,
  },
});
