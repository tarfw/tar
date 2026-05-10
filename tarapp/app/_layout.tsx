import "../global.css";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { initDb, getDbClient } from "../lib/db";

export default function RootLayout() {
  useEffect(() => {
    let syncInterval: NodeJS.Timeout;

    // Initialize Database and Schema
    initDb()
      .then(() => {
        // Hide the native splash screen after DB is ready
        SplashScreen.hideAsync();

        syncInterval = setInterval(async () => {
          try {
            const db = getDbClient();
            await db.push();
            await db.pull();
          } catch (e) {
            console.error("Background sync error:", e);
          }
        }, 3000);
      })
      .catch((err) => {
        console.error("Failed to initialize database:", err);
        SplashScreen.hideAsync();
      });

    return () => {
      if (syncInterval) clearInterval(syncInterval);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "white" },
        }}
      />
    </SafeAreaProvider>
  );
}
