import { useState, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useThemeMode } from "@/hooks/use-theme-context";
import { useTheme } from "@/hooks/use-theme";
import { getCurrentUser, signOutGoogle, type UserProfile } from "@/lib/auth";
import { useEmbeddings } from "@/db/embeddings-provider";

// Import @expo/ui elements
import { Host, ScrollView, FieldGroup, List, ListItem, Switch, Text, Button, Row } from "@expo/ui";

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
    <Host style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView style={styles.container}>
        
        {/* Section 1: AI Models */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>AI Models</Text>
        <FieldGroup style={styles.section}>
          <List>
            <ListItem>
              <ListItem.HeadlineContent>
                <Text style={{ color: theme.text, fontSize: 17 }}>Embedding (350M)</Text>
              </ListItem.HeadlineContent>
              <ListItem.TrailingContent>
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
                    <Button label="Download" variant="filledTonal" onPress={loadModel} />
                  )}
                </Row>
              </ListItem.TrailingContent>
            </ListItem>
            
            <ListItem>
              <ListItem.HeadlineContent>
                <Text style={{ color: theme.text, fontSize: 17 }}>Model Info</Text>
              </ListItem.HeadlineContent>
              <ListItem.TrailingContent>
                <Text style={{ color: theme.textSecondary, fontSize: 17 }}>
                  384-dim • Cosine • MiniLM
                </Text>
              </ListItem.TrailingContent>
            </ListItem>
          </List>
        </FieldGroup>

        {/* Section 2: Appearance */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Appearance</Text>
        <FieldGroup style={styles.section}>
          <List>
            <ListItem onPress={() => setThemeMode(themeMode === "light" ? "dark" : "light")}>
              <ListItem.HeadlineContent>
                <Text style={{ color: theme.text, fontSize: 17 }}>Theme</Text>
              </ListItem.HeadlineContent>
              <ListItem.TrailingContent>
                <Row alignment="center" style={{ gap: 8 }}>
                  <Ionicons
                    name={themeMode === "light" ? "sunny" : "moon"}
                    size={20}
                    color={themeMode === "light" ? "#FFB800" : "#8B5CF6"}
                  />
                  <Text style={{ color: theme.textSecondary, fontSize: 17 }}>
                    {themeMode === "light" ? "Light" : "Dark"}
                  </Text>
                </Row>
              </ListItem.TrailingContent>
            </ListItem>
          </List>
        </FieldGroup>

        {/* Section 3: Notifications */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Notifications</Text>
        <FieldGroup style={styles.section}>
          <List>
            <ListItem>
              <ListItem.HeadlineContent>
                <Text style={{ color: theme.text, fontSize: 17 }}>Push Notifications</Text>
              </ListItem.HeadlineContent>
              <ListItem.TrailingContent>
                <Switch value={notifications} onValueChange={setNotifications} />
              </ListItem.TrailingContent>
            </ListItem>
          </List>
        </FieldGroup>

        {/* Section 4: General */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>General</Text>
        <FieldGroup style={styles.section}>
          <List>
            <ListItem onPress={() => router.push("/actions-catalog" as any)}>
              <ListItem.HeadlineContent>
                <Text style={{ color: theme.text, fontSize: 17 }}>Actions</Text>
              </ListItem.HeadlineContent>
              <ListItem.TrailingContent>
                <Text style={{ color: theme.textSecondary, fontSize: 17 }}>{">"}</Text>
              </ListItem.TrailingContent>
            </ListItem>
            
            <ListItem>
              <ListItem.HeadlineContent>
                <Text style={{ color: theme.text, fontSize: 17 }}>Language</Text>
              </ListItem.HeadlineContent>
              <ListItem.TrailingContent>
                <Text style={{ color: theme.textSecondary, fontSize: 17 }}>English</Text>
              </ListItem.TrailingContent>
            </ListItem>
            
            <ListItem>
              <ListItem.HeadlineContent>
                <Text style={{ color: theme.text, fontSize: 17 }}>Region</Text>
              </ListItem.HeadlineContent>
              <ListItem.TrailingContent>
                <Text style={{ color: theme.textSecondary, fontSize: 17 }}>United States</Text>
              </ListItem.TrailingContent>
            </ListItem>
          </List>
        </FieldGroup>

        {/* Section 5: About */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>About</Text>
        <FieldGroup style={styles.section}>
          <List>
            <ListItem>
              <ListItem.HeadlineContent>
                <Text style={{ color: theme.text, fontSize: 17 }}>Version</Text>
              </ListItem.HeadlineContent>
              <ListItem.TrailingContent>
                <Text style={{ color: theme.textSecondary, fontSize: 17 }}>1.0.0</Text>
              </ListItem.TrailingContent>
            </ListItem>
            
            <ListItem>
              <ListItem.HeadlineContent>
                <Text style={{ color: theme.text, fontSize: 17 }}>Privacy Policy</Text>
              </ListItem.HeadlineContent>
              <ListItem.TrailingContent>
                <Text style={{ color: theme.textSecondary, fontSize: 17 }}>{">"}</Text>
              </ListItem.TrailingContent>
            </ListItem>
            
            <ListItem>
              <ListItem.HeadlineContent>
                <Text style={{ color: theme.text, fontSize: 17 }}>Terms of Service</Text>
              </ListItem.HeadlineContent>
              <ListItem.TrailingContent>
                <Text style={{ color: theme.textSecondary, fontSize: 17 }}>{">"}</Text>
              </ListItem.TrailingContent>
            </ListItem>
          </List>
        </FieldGroup>

        {/* Section 6: Account */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Account</Text>
        <FieldGroup style={styles.section}>
          <List>
            {user?.name && (
              <ListItem>
                <ListItem.HeadlineContent>
                  <Text style={{ color: theme.text, fontSize: 17 }}>{user.name}</Text>
                </ListItem.HeadlineContent>
              </ListItem>
            )}
            
            {user?.email && (
              <ListItem>
                <ListItem.HeadlineContent>
                  <Text style={{ color: theme.textSecondary, fontSize: 17 }}>{user.email}</Text>
                </ListItem.HeadlineContent>
              </ListItem>
            )}
            
            <ListItem onPress={handleSignOut}>
              <ListItem.HeadlineContent>
                <Text style={{ color: "#FF3B30", fontSize: 17 }}>Sign Out</Text>
              </ListItem.HeadlineContent>
            </ListItem>
          </List>
        </FieldGroup>

      </ScrollView>
    </Host>
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
});
