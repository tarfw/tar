import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import "../global.css";
import { getDb, syncDb } from '../lib/db';
import { useIndexingService } from '../lib/indexing-service';

const queryClient = new QueryClient();

export default function RootLayout() {
    useIndexingService(); // Runs in background when model is ready

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
        <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
                <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
                    <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="(tabs)" />

                    </Stack>
                    <StatusBar style="dark" />
                </SafeAreaView>
            </QueryClientProvider>
        </SafeAreaProvider>
    );
}
