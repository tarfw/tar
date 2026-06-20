
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { ThemeProvider, useThemeMode } from '@/hooks/use-theme-context';
import { DbProvider } from '@/db/provider';
import { EmbeddingsProvider } from '@/db/embeddings-provider';
import { Colors } from '@/constants/theme';
import { initDb } from '@/lib/db';
import { initEmbeddings } from '@/lib/embeddings';
import { checkAndSyncExistingForms } from '@/lib/vectorStore';

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

        console.log(`[BOOT] ${ms()} — vector sync START (fire & forget)`);
        checkAndSyncExistingForms().catch(e => console.warn(`[BOOT] ${ms()} — Vector sync error:`, e));
      } catch (e) {
        console.error(`[BOOT] ${ms()} — Init FAILED:`, e);
      } finally {
        console.log(`[BOOT] ${ms()} — ready → true`);
        setReady(true);
      }
    })();
  }, []);

  console.log(`[BOOT] ${ms()} — RootLayoutInner render — ready: ${ready}`);

  if (!ready) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="actions" options={{ headerShown: false }} />
        <Stack.Screen name="(nav)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="workspace" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="detail" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="add" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="browse" options={{ headerShown: false, animation: 'fade', animationDuration: 150 }} />
        <Stack.Screen name="aisearch" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="entity" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="crm" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="team" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="task" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="products" options={{ headerShown: false, animation: 'slide_from_right' }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <DbProvider>
      <ThemeProvider>
        <EmbeddingsProvider>
          <RootLayoutInner />
        </EmbeddingsProvider>
      </ThemeProvider>
    </DbProvider>
  );
}
