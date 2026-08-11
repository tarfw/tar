import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import * as SplashScreen from 'expo-splash-screen';

import { ThemeProvider, useThemeMode } from '@/hooks/use-theme-context';
import { DbProvider } from '@/db/provider';
import { EmbeddingsProvider } from '@/db/embeddings-provider';
import { Colors } from '@/constants/theme';
import { initDb, getSelfId } from '@/lib/db';
import { initEmbeddings } from '@/lib/embeddings';
import { setUserId } from '@/lib/tar';

// Keep the splash screen visible while assets & DB load
SplashScreen.preventAutoHideAsync().catch(() => {});

const T0 = Date.now();
function ms() { return `${Date.now() - T0}ms`; }


function RootLayoutInner() {
  const { resolvedScheme } = useThemeMode();
  const colors = Colors[resolvedScheme];
  const [ready, setReady] = useState(false);

  useEffect(() => {
    console.log(`[BOOT] ${ms()} — RootLayoutInner useEffect START`);
    (async () => {
      try {
        console.log(`[BOOT] ${ms()} — initEmbeddings() START`);
        initEmbeddings();
        console.log(`[BOOT] ${ms()} — initEmbeddings() DONE (sync)`);

        console.log(`[BOOT] ${ms()} — initDb() START`);
        await initDb();
        console.log(`[BOOT] ${ms()} — initDb() DONE`);

        console.log(`[BOOT] ${ms()} — getSelfId() START`);
        const userId = await getSelfId();
        console.log(`[BOOT] ${ms()} — getSelfId() DONE: ${userId}`);
        setUserId(userId);
      } catch (e) {
        console.error(`[BOOT] ${ms()} — Init FAILED:`, e);
      } finally {
        console.log(`[BOOT] ${ms()} — ready → true`);
        setReady(true);
        await SplashScreen.hideAsync().catch(() => {});
      }
    })();
  }, []);

  console.log(`[BOOT] ${ms()} — RootLayoutInner render — ready: ${ready}`);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 0,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <KeyboardProvider>
      <DbProvider>
        <ThemeProvider>
          <EmbeddingsProvider>
            <RootLayoutInner />
          </EmbeddingsProvider>
        </ThemeProvider>
      </DbProvider>
    </KeyboardProvider>
  );
}
