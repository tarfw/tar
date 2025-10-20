import { Stack } from "expo-router";
import { View, Text } from 'react-native';
import db from '../db';
import Login from './login';

export default function RootLayout() {
  const { isLoading, user } = db.useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (user) {
    return (
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: 'white' },
          headerShown: false,
        }}
      />
    );
  }

  return <Login />;
}
