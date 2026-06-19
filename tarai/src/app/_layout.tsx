import { View } from 'react-native';
import { Stack } from 'expo-router';

import { ThemeProvider, useThemeMode } from '@/hooks/use-theme-context';
import { DbProvider } from '@/db/provider';
import { Colors } from '@/constants/theme';

function RootLayoutInner() {
  const { resolvedScheme } = useThemeMode();
  const colors = Colors[resolvedScheme];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="(nav)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="workspace" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="detail" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="add" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="browse" options={{ headerShown: false, animation: 'fade', animationDuration: 150 }} />
        <Stack.Screen name="team" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="task" options={{ headerShown: false, animation: 'slide_from_right' }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <DbProvider>
      <ThemeProvider>
        <RootLayoutInner />
      </ThemeProvider>
    </DbProvider>
  );
}
