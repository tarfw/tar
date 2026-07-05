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

  const Label = ({ children }: { children: React.ReactNode }) => (
    <Text style={{ color: theme.text, fontSize: 17 }}>{children}</Text>
  );

  const Value = ({ children }: { children: React.ReactNode }) => (
    <Text style={{ color: theme.textSecondary, fontSize: 17 }}>{children}</Text>
  );

  return (
    <Host style={{ flex: 1, backgroundColor: theme.background }} useViewportSizeMeasurement>
      <FieldGroup style={styles.container}>

        {/* AI Models */}
        <FieldGroup.Section title="AI Models" titleUppercase>
          <Row alignment="center" style={styles.row}>
            <Label>Embedding (350M)</Label>
            <Row alignment="center" style={{ gap: 8 }}>
              {isReady && (
                <>
                  <Value>Ready</Value>
                  <Button label="Clear" variant="text" onPress={clearModel} />
                </>
              )}
              {isLoading && (
                <Value>{Math.round(downloadProgress * 100)}%</Value>
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
            <Label>Model Info</Label>
            <Value>384-dim  Cosine  MiniLM</Value>
          </Row>
        </FieldGroup.Section>

        {/* Appearance */}
        <FieldGroup.Section title="Appearance" titleUppercase>
          <ListItem
            onPress={() => setThemeMode(themeMode === "light" ? "dark" : "light")}
          >
            <Label>Theme</Label>
            <Value>{themeMode === "light" ? "Light" : "Dark"}</Value>
          </ListItem>
        </FieldGroup.Section>

        {/* Notifications */}
        <FieldGroup.Section title="Notifications" titleUppercase>
          <Row alignment="center" style={styles.row}>
            <Label>Push Notifications</Label>
            <Switch value={notifications} onValueChange={setNotifications} />
          </Row>
        </FieldGroup.Section>

        {/* General */}
        <FieldGroup.Section title="General" titleUppercase>
          <ListItem onPress={() => router.push("/actions-catalog" as any)}>
            <Label>Actions</Label>
          </ListItem>
          <Row alignment="center" style={styles.row}>
            <Label>Language</Label>
            <Value>English</Value>
          </Row>
          <Row alignment="center" style={styles.row}>
            <Label>Region</Label>
            <Value>India</Value>
          </Row>
        </FieldGroup.Section>

        {/* About */}
        <FieldGroup.Section title="About" titleUppercase>
          <Row alignment="center" style={styles.row}>
            <Label>Version</Label>
            <Value>1.0.0</Value>
          </Row>
          <Row alignment="center" style={styles.row}>
            <Label>Privacy Policy</Label>
          </Row>
          <Row alignment="center" style={styles.row}>
            <Label>Terms of Service</Label>
          </Row>
        </FieldGroup.Section>

        {/* Account */}
        <FieldGroup.Section title="Account" titleUppercase>
          {user?.name && (
            <Row alignment="center" style={styles.row}>
              <Label>{user.name}</Label>
            </Row>
          )}
          {user?.email && (
            <Row alignment="center" style={styles.row}>
              <Value>{user.email}</Value>
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
    paddingHorizontal: 4,
  },
});
