import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { getDb, syncDb } from '../lib/db';

export default function RootLayout() {
    useEffect(() => {
        const initDb = async () => {
            try {
                // Initialize DB and Schema
                await getDb();
                // Perform initial sync
                await syncDb();
            } catch (error) {
                console.error('Failed to initialize database:', error);
            }
        };

        initDb();
    }, []);

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
