import "../global.css";
import { Stack } from "expo-router";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { AppState, Alert } from "react-native";
import { initDb, getUserDb } from "../lib/db";
import { getEmbeddings } from "../lib/embeddings";
import { checkAndSyncExistingMatters } from "../lib/vectorStore";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
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

        // Periodic Reminder Active Trigger Checker
        reminderInterval = setInterval(async () => {
          try {
            const db = getUserDb();
            const nowStr = new Date().toISOString();
            
            const findRemindersQuery = `
              SELECT m.*, t.title 
              FROM mass m 
              LEFT JOIN matter t ON m.matter = t.id 
              WHERE m.active = 1 AND m.type = 'reminder' AND m.scope = 'p' AND m.start <= ?
            `;
            
            const reminders = await db.all(findRemindersQuery, [nowStr]);

            if (Array.isArray(reminders)) {
              for (const reminder of reminders) {
                // Mark inactive immediately to prevent repeated alert triggers
                await db.run("UPDATE mass SET active = 0 WHERE id = ?", [reminder.id]);
                
                // Insert completion/triggered log entry
                const motionId = `mot_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                const seqRow = await db.all("SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM motion WHERE stream = ?", [reminder.matter]);
                const seq = seqRow[0]?.next_seq || 1;
                
                await db.run(
                  "INSERT INTO motion (id, stream, seq, action, status, delta, scope, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                  [
                    motionId,
                    reminder.matter,
                    seq,
                    504, // TASK_ASSIGNED Opcode from plan.md
                    "COMPLETED",
                    null,
                    "p", // scope
                    JSON.stringify({ task: reminder.title || "Reminder due", triggered_at: nowStr })
                  ]
                );
                
                // Trigger local UX alert
                Alert.alert(
                  "🔔 Reminder Alert",
                  `${reminder.title || "Your scheduled reminder is due!"}`,
                  [{ text: "Acknowledge" }]
                );
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

    return () => {
      if (reminderInterval) clearInterval(reminderInterval);
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
      >
        <Stack.Screen
          name="superagent"
          options={{
            animation: "fade",
            animationDuration: 120,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
