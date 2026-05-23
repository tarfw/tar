import "../global.css";
import { Stack } from "expo-router";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { AppState, Alert } from "react-native";
import { initDb, getUserDb, getTenantDb, getDbClient } from "../lib/db";
import { getEmbeddings } from "../lib/embeddings";
import { checkAndSyncExistingMatters } from "../lib/vectorStore";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let syncInterval: any;
    let reminderInterval: any;

    // Initialize Database, Schema, and Embedding Model
    Promise.all([
      initDb(),
      getEmbeddings().catch((e) => console.error("Failed to load model:", e))
    ])
      .then(() => {
        setIsReady(true);
        SplashScreen.hideAsync();

        // Run background indexing check for any legacy/unindexed matters
        checkAndSyncExistingMatters().catch((e) => console.error("Initial sync check failed:", e));


        // Slow periodic backup sync fallback
        syncInterval = setInterval(async () => {
          try {
            const db = getDbClient();
            await db.push();
            await db.pull();
          } catch (e) {
            console.error("Background sync error:", e);
          }
        }, 30000); // 30s fallback

        // Periodic Reminder Active Trigger Checker
        reminderInterval = setInterval(async () => {
          try {
            const uDb = getUserDb();
            const tDb = getTenantDb();
            const nowStr = new Date().toISOString();
            
            const findRemindersQuery = `
              SELECT m.*, t.title 
              FROM mass m 
              LEFT JOIN matter t ON m.matter = t.id 
              WHERE m.active = 1 AND m.type = 'slot' AND m.scope = 'reminder' AND m.start <= ?
            `;
            
            const uReminders = await uDb.all(findRemindersQuery, [nowStr]);
            const tReminders = await tDb.all(findRemindersQuery, [nowStr]);

            const dbsWithReminders = [
              { db: uDb, list: uReminders },
              { db: tDb, list: tReminders }
            ];

            for (const item of dbsWithReminders) {
              if (Array.isArray(item.list)) {
                for (const reminder of item.list) {
                  // Mark inactive immediately to prevent repeated alert triggers
                  await item.db.run("UPDATE mass SET active = 0 WHERE id = ?", [reminder.id]);
                  
                  // Insert completion/triggered log entry
                  const motionId = `mot_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                  const seqRow = await item.db.all("SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?", [reminder.matter]);
                  const seq = seqRow[0]?.next_seq || 1;
                  
                  await item.db.run(
                    "INSERT INTO motion (id, stream, seq, action, status, delta, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [
                      motionId,
                      reminder.matter,
                      seq,
                      105, // REMINDER Opcode
                      "COMPLETED",
                      null,
                      JSON.stringify({ task: reminder.title || "Reminder due", triggered_at: nowStr })
                    ]
                  );

                  await item.db.push();
                  
                  // Trigger local UX alert
                  Alert.alert(
                    "🔔 Reminder Alert",
                    `${reminder.title || "Your scheduled reminder is due!"}`,
                    [{ text: "Acknowledge" }]
                  );
                }
              }
            }
          } catch (e) {
            console.error("Reminder check failed:", e);
          }
        }, 15000); // Check every 15s
      })
      .catch((err) => {
        console.error("Failed to initialize database:", err);
        SplashScreen.hideAsync();
      });

    // AppState Listener: Sync immediately when user returns to app
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        console.log("App came to foreground, pulling from remote...");
        try {
          const db = getDbClient();
          await db.pull();
        } catch (e) {
          console.error("Foreground pull failed:", e);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      if (syncInterval) clearInterval(syncInterval);
      if (reminderInterval) clearInterval(reminderInterval);
      subscription.remove();
    };
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "white" },
        }}
      />
    </SafeAreaProvider>
  );
}
