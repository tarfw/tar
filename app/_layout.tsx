import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import "../global.css";
import { getDb, syncDb } from '../lib/db';
import { getGroqApiKey } from '../lib/groq-service';
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
                // Seed Groq API key if not already set
                const existing = await getGroqApiKey();
                if (!existing) {
                    // await setGroqApiKey('YOUR_KEY_HERE');
                }
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
                        <Stack.Screen
                            name="memory"
                            options={{
                                presentation: 'fullScreenModal',
                                animation: 'slide_from_bottom'
                            }}
                        />
                        <Stack.Screen
                            name="mstate"
                            options={{
                                title: 'Memory Details',
                                headerShown: false,
                                animation: 'fade_from_bottom',
                                animationDuration: 200
                            }}
                        />
                        <Stack.Screen
                            name="add-event"
                            options={{
                                title: 'Create Event',
                                headerShown: false,
                            }}
                        />
                    </Stack>
                    <StatusBar style="dark" />
                </SafeAreaView>
            </QueryClientProvider>
        </SafeAreaProvider>
    );
}
