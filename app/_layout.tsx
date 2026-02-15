import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import "../global.css";
import { getDb, syncDb } from '../lib/db';
import { useIndexingService } from '../lib/indexing-service';

const queryClient = new QueryClient();

export default function RootLayout() {
    useIndexingService(); // Runs in background when model is ready
    const { setColorScheme } = useColorScheme();

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

        const checkDefaultTheme = async () => {
            try {
                const hasSetDefaultTheme = await SecureStore.getItemAsync('hasSetDefaultTheme');
                if (!hasSetDefaultTheme) {
                    setColorScheme('light');
                    await SecureStore.setItemAsync('hasSetDefaultTheme', 'true');
                }
            } catch (error) {
                console.error('Failed to set default theme:', error);
            }
        };

        initDb();
        checkDefaultTheme();
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
                    <StatusBar style="auto" />
                </SafeAreaView>
            </QueryClientProvider>
        </SafeAreaProvider>
    );
}
