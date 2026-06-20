
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

function RootLayoutInner() {
  console.log('[LAYOUT] RootLayoutInner rendered');
  const { resolvedScheme } = useThemeMode();
  const colors = Colors[resolvedScheme];
  const [ready, setReady] = useState(false);

  useEffect(() => {
    console.log('[LAYOUT] useEffect - starting initialization');
    (async () => {
      try {
        console.log('[LAYOUT] Initializing embeddings...');
        initEmbeddings();
        console.log('[LAYOUT] Initializing database...');
        await initDb();
        console.log('[LAYOUT] Database initialized, running vector sync...');
        checkAndSyncExistingForms().catch(e => console.warn('[Layout] Vector sync deferred:', e));
      } catch (e) {
        console.error('[Layout] Init failed:', e);
      } finally {
        console.log('[LAYOUT] Setting ready=true');
        setReady(true);
      }
    })();
  }, []);

  console.log('[LAYOUT] ready:', ready);

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
        <Stack.Screen name="auth" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="(nav)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="workspace" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="detail" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="add" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="browse" options={{ headerShown: false, animation: 'fade', animationDuration: 150 }} />
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
