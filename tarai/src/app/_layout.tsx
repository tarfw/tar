import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { ThemeProvider, useThemeMode } from '@/hooks/use-theme-context';
import { DbProvider } from '@/db/provider';
import { EmbeddingsProvider } from '@/db/embeddings-provider';
import { Colors } from '@/constants/theme';
import { initDb, getSelfId } from '@/lib/db';
import { initEmbeddings } from '@/lib/embeddings';
import { checkAndSyncExistingForms } from '@/lib/vectorStore';
// Flue: old seed.ts and store.ts removed - actions now use Flue defineAction

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
        setActionUserId(userId);
        console.log(`[BOOT] ${ms()} — getSelfId() DONE: ${userId}`);

        console.log(`[BOOT] ${ms()} — ensureBuiltins() START`);
        await ensureBuiltins();
        console.log(`[BOOT] ${ms()} — ensureBuiltins() DONE`);

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
            headerShown: false,
            animation: 'fade',
            animationDuration: 0,
            contentStyle: { backgroundColor: colors.background },
          }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="actions" />
        <Stack.Screen name="(nav)" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="workspace" />
        <Stack.Screen name="add" />
        <Stack.Screen name="add-item" />
        <Stack.Screen name="browse" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="actions-catalog" />
        <Stack.Screen name="entity" />
        <Stack.Screen name="product" />
        <Stack.Screen name="personal" />
      </Stack>
    </View>
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
