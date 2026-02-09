import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

export default function RootLayout() {
    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                    name="memory"
                    options={{
                        presentation: 'fullScreenModal',
                        animation: 'slide_from_bottom'
                    }}
                />
            </Stack>
            <StatusBar style="dark" />
        </View>
    );
}
