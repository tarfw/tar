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
            {/* Left Section: Memory + Tabs */}
            <View style={styles.leftWrapper}>
                {/* Memory Selector (Floating Above Left) */}
                <View style={styles.floatingLabelContainer}>
                    <TouchableOpacity
                        style={styles.pillSelector}
                        onPress={() => router.push('/memory')}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="brain" size={14} color="#000" />
                        <Text style={styles.pillText}>{memory}</Text>
                    </TouchableOpacity>
                </View>

                {/* Left Container: Tabs */}
                <BlurView intensity={90} tint="light" style={styles.leftContainer}>
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
                        if (route.name === 'tasks') {
                            // Tasks
                            iconName = isFocused ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline';
                        } else if (route.name === 'index') {
                            // Agents
                            iconName = isFocused ? 'square-rounded' : 'square-rounded-outline';
                        } else if (route.name === 'relay') {
                            // Relay
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
                                <MaterialCommunityIcons
                                    name={iconName}
                                    size={28}
                                    color={isFocused ? '#006AFF' : '#8E8E93'}
                                />
                            </TouchableOpacity>
                        );
                    })}
                </BlurView>
            </View>

            {/* Right Section: Ask AI + Actions */}
            <View style={styles.rightWrapper}>
                {/* Ask AI (Floating Above Right) */}
                <View style={[styles.floatingLabelContainer, { alignItems: 'flex-end' }]}>
                    <TouchableOpacity
                        style={[styles.pillSelector, styles.actionPill]}
                        onPress={() => { }}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="message-text-outline" size={14} color="#000" />
                        <Text style={styles.pillText}>Ask AI</Text>
                    </TouchableOpacity>
                </View>

                {/* Right Container: Actions */}
                <BlurView intensity={90} tint="light" style={styles.rightContainer}>
                    <TouchableOpacity
                        style={styles.actionItem}
                        onPress={() => router.push('/search')}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="magnify" size={28} color="#000" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionItem, styles.addButton]}
                        onPress={() => router.push('/add-node')}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
                    </TouchableOpacity>
                </BlurView>
            </View>
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
        bottom: 30,
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 20,
        alignItems: 'flex-end',
    },
    leftWrapper: {
        flex: 1,
        marginRight: 15,
        alignItems: 'flex-start',
        // Removed maxWidth to allow memory selector to expand
    },
    rightWrapper: {
        alignItems: 'flex-end',
    },
    floatingLabelContainer: {
        marginBottom: 10,
        width: '100%',
    },
    pillSelector: {
        backgroundColor: '#fff',
        paddingHorizontal: 22,
        paddingVertical: 10,
        borderRadius: 24, // Slightly rounder to match size increase
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    actionPill: {
        backgroundColor: '#F8F9FA',
    },
    pillText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
        marginLeft: 6,
    },
    leftContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 35,
        height: 65,
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        width: width * 0.45, // Fixed width relative to screen, decoupled from wrapper
        justifyContent: 'space-around',
    },
    rightContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 35,
        paddingHorizontal: 5,
        height: 65,
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        gap: 5,
    },
    tabItem: {
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        flex: 1,
    },
    actionItem: {
        width: 50,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 25,
    },
    addButton: {
        backgroundColor: '#006AFF',
    },
});
