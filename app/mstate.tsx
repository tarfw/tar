import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';

/**
 * MEMORY DETAIL SCREEN (mstate.tsx)
 * Redesigned with NativeWind: Modern, Futuristic, Minimal.
 */

export default function MemoryDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Parse the item data from params
    const { title, subtitle, type, ...rest } = params;

    const renderDetailRow = (label: string, value: any) => {
        if (value === undefined || value === null || value === '' || label === 'id') return null;

        return (
            <View key={label} className="mb-6">
                <Text className="text-[10px] font-bold text-slate-400 tracking-[2px] uppercase mb-1">
                    {label.replace(/_/g, ' ')}
                </Text>
                <Text className="text-base text-slate-800 font-medium">
                    {String(value)}
                </Text>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="flex-row items-center justify-between px-4 h-16 border-b border-slate-50">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center rounded-full bg-slate-50"
                >
                    <MaterialCommunityIcons name="arrow-left" size={20} color="#0F172A" />
                </TouchableOpacity>
                <Text className="text-lg font-semibold text-slate-900">Memory State</Text>
                <TouchableOpacity className="w-10 h-10 items-center justify-center">
                    <MaterialCommunityIcons name="dots-vertical" size={20} color="#0F172A" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Hero Section */}
                <View className="px-6 pt-10 pb-8">
                    <View className="w-16 h-16 rounded-2xl bg-blue-50 items-center justify-center mb-6">
                        <MaterialCommunityIcons
                            name={(type === 'actor' || type === 'actors') ? 'account-outline' : 'database-outline'}
                            size={32}
                            color="#3B82F6"
                        />
                    </View>
                    <Text className="text-3xl font-bold text-slate-900 tracking-tight">
                        {title || 'Unknown Entity'}
                    </Text>
                    <View className="flex-row items-center mt-2">
                        <View className="px-2 py-0.5 rounded bg-slate-100 mr-2">
                            <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                {String(type || 'node')}
                            </Text>
                        </View>
                        <Text className="text-slate-400 text-sm font-medium">{subtitle}</Text>
                    </View>
                </View>

                {/* Content / Details */}
                <View className="px-6">
                    <View className="h-[1px] bg-slate-100 w-12 mb-8" />

                    <View>
                        {Object.entries(rest).map(([key, value]) => renderDetailRow(key, value))}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
