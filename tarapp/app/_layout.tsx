import "../global.css";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { initDb } from "../lib/db";

export default function RootLayout() {
  useEffect(() => {
    // Initialize Database and Schema
    initDb()
      .then(() => {
        // Hide the native splash screen after DB is ready
        SplashScreen.hideAsync();
      })
      .catch((err) => {
        console.error("Failed to initialize database:", err);
        SplashScreen.hideAsync();
      });
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
