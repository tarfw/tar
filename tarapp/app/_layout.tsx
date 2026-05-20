import "../global.css";
import { Stack } from "expo-router";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { initDb, getDbClient } from "../lib/db";
import { useState } from "react";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let syncInterval: NodeJS.Timeout;

    // Initialize Database and Schema
    initDb()
      .then(() => {
        setIsReady(true);
        SplashScreen.hideAsync();

        // Fallback slow poll just in case
        syncInterval = setInterval(async () => {
          try {
            const db = getDbClient();
            await db.push();
            await db.pull();
          } catch (e) {
            console.error("Background sync error:", e);
          }
        }, 30000); // 30s fallback
      })
      .catch((err) => {
        console.error("Failed to initialize database:", err);
        SplashScreen.hideAsync();
      });

    // AppState Listener: Sync immediately when user opens/returns to the app
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
