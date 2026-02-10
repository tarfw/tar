import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useMemoryStore } from '../../hooks/use-memory-store';

const { width } = Dimensions.get('window');

function CustomTabBar({ state, descriptors, navigation }: any) {
    const router = useRouter();
    const { memory } = useMemoryStore();

    return (
        <View style={styles.tabBarContainer}>
            <View style={styles.selectorRow}>
                <TouchableOpacity
                    style={styles.memorySelector}
                    onPress={() => router.push('/memory')}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="brain" size={14} color="#000" />
                    <Text style={styles.memoryText}>{memory}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.memorySelector, styles.actionButton]}
                    onPress={() => { }}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="message-text-outline" size={14} color="#000" />
                    <Text style={styles.memoryText}>Ask AI</Text>
                </TouchableOpacity>
            </View>

            <BlurView intensity={90} tint="light" style={styles.blurContainer}>
                <View style={styles.tabBarWrapper}>
                    <View style={styles.tabBar}>
                        {state.routes.map((route: any, index: number) => {
                            const { options } = descriptors[route.key];
                            const isFocused = state.index === index;

                            const onPress = () => {
                                const event = navigation.emit({
                                    type: 'tabPress',
                                    target: route.key,
                                    canPreventDefault: true,
                                });

                                if (!isFocused && !event.defaultPrevented) {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    navigation.navigate(route.name);
                                }
                            };

                            let iconName: any;
                            let iconSize = 24;
                            if (route.name === 'tasks') {
                                iconName = isFocused ? 'circle' : 'circle-outline';
                            } else if (route.name === 'index') {
                                iconName = isFocused ? 'square-rounded' : 'square-rounded-outline';
                            } else if (route.name === 'relay') {
                                iconName = 'asterisk';
                            }

                            return (
                                <TouchableOpacity
                                    key={route.name}
                                    accessibilityRole="button"
                                    accessibilityState={isFocused ? { selected: true } : {}}
                                    onPress={onPress}
                                    style={styles.tabItem}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.iconContainer}>
                                        <MaterialCommunityIcons
                                            name={iconName}
                                            size={iconSize}
                                            color={isFocused ? '#006AFF' : '#A0A0A0'}
                                        />
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </BlurView>
        </View>
    );
}

export default function TabLayout() {
    return (
        <Tabs
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
            }}
        >
            <Tabs.Screen
                name="tasks"
                options={{
                    headerTitle: 'Tasks',
                }}
            />
            <Tabs.Screen
                name="index"
                options={{
                    headerTitle: 'Agents',
                }}
            />
            <Tabs.Screen
                name="relay"
                options={{
                    headerTitle: 'Relay',
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBarContainer: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        width: width * 0.85,
    },
    selectorRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    memorySelector: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        marginBottom: 12,
    },
    actionButton: {
        backgroundColor: '#F2F2F2',
        borderColor: 'rgba(0,0,0,0.05)',
    },
    memoryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000',
        marginLeft: 6,
        letterSpacing: -0.3,
    },
    blurContainer: {
        width: '100%',
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
    },
    tabBarWrapper: {
        paddingHorizontal: 10,
        paddingVertical: 14,
    },
    tabBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
});


