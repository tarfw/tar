import '@/polyfills';
import { Stack } from "expo-router";
import { View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import db from '../db';
import Login from './login';

export default function RootLayout() {
  const { isLoading, user } = db.useAuth();

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
          <Text>Loading...</Text>
        </View>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  if (user) {
    return (
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: 'white' },
            headerShown: false,
          }}
        />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <Login />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
