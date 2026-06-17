import { Stack, useRouter, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Pressable } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ThemeProvider as CustomThemeProvider, useThemeMode } from '@/hooks/use-theme-context';
import { Colors } from '@/constants/theme';

function RootLayoutInner() {
  const { resolvedScheme } = useThemeMode();
  const colors = Colors[resolvedScheme];
  const router = useRouter();

  return (
    <ThemeProvider value={resolvedScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}>
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Settings',
            presentation: 'modal',
            headerLeft: () => (
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                <SymbolView
                  name="chevron.left"
                  size={24}
                  tintColor={colors.text}
                />
              </Pressable>
            ),
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <CustomThemeProvider>
      <RootLayoutInner />
    </CustomThemeProvider>
  );
}
