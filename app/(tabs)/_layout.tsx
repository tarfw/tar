import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Tabs, usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMemoryStore } from '../../hooks/use-memory-store';
import { syncDb } from '../../lib/db';

const { width } = Dimensions.get('window');

function CustomTabBar({ state, descriptors, navigation }: any) {
    const router = useRouter();

    return (
        <View style={styles.tabBarContainer}>
            {/* Left Section: Tabs */}
            <View style={styles.leftWrapper}>
                <BlurView intensity={90} tint="light" style={styles.leftContainer}>
                    {state.routes
                        .filter((route: any) => route.name !== 'relay')
                        .map((route: any, index: number) => {
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
                            if (route.name === 'trace') {
                                iconName = 'record-circle-outline';
                            } else if (route.name === 'index') {
                                iconName = 'square-rounded-outline';
                            }

                            const IconComponent = route.name === 'trace' ? Feather : MaterialCommunityIcons;
                            const finalIconName = route.name === 'trace' ? 'circle' : iconName;

                            return (
                                <TouchableOpacity
                                    key={route.name}
                                    accessibilityRole="button"
                                    accessibilityState={isFocused ? { selected: true } : {}}
                                    onPress={onPress}
                                    style={styles.tabItem}
                                    activeOpacity={0.7}
                                >
                                    <IconComponent
                                        name={finalIconName as any}
                                        size={route.name === 'trace' ? 24 : 28}
                                        color={isFocused ? '#006AFF' : '#8E8E93'}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                </BlurView>
            </View>

            {/* Right Section: Actions */}
            <View style={styles.rightWrapper}>
                <BlurView intensity={90} tint="light" style={styles.rightContainer}>
                    <TouchableOpacity
                        style={[styles.actionItem, styles.addButton]}
                        onPress={() => router.push('/memory')}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
                    </TouchableOpacity>
                </BlurView>
            </View>
        </View>
    );
}

function TopBar() {
    const { memory } = useMemoryStore();
    const router = useRouter();
    const pathname = usePathname();
    const [currentTime, setCurrentTime] = React.useState(new Date());

    React.useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const handleSync = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await syncDb();
    };

    const isAgentsScreen = pathname === '/' || pathname === '/index';

    return (
        <View style={styles.topBarContainer}>
            <View style={styles.leftGroup}>
                <TouchableOpacity
                    style={styles.pillSelector}
                    onPress={() => router.push('/memory')}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons name="brain" size={18} color="#006AFF" style={{ marginRight: 6 }} />
                    <Text style={styles.pillText}>Memory</Text>
                </TouchableOpacity>

                <View style={styles.clockContainer}>
                    <Text style={styles.clockText}>{timeString}</Text>
                </View>
            </View>

            <View style={styles.rightActionsGroup}>
                {!isAgentsScreen && (
                    <TouchableOpacity
                        style={styles.topActionItem}
                        onPress={handleSync}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="brain" size={20} color="#000" />
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={styles.topActionItem}
                    onPress={() => router.push('/relay')}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons name="asterisk" size={20} color="#000" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.profileCircle}
                    activeOpacity={0.8}
                >
                    <Text style={styles.profileInitial}>A</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function TabLayout() {
    return (
        <View style={{ flex: 1 }}>
            <TopBar />
            <Tabs
                tabBar={(props) => <CustomTabBar {...props} />}
                screenOptions={{
                    headerShown: false,
                    tabBarShowLabel: false,
                }}
            >
                <Tabs.Screen
                    name="trace"
                    options={{
                        headerTitle: 'Trace',
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
        </View>
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
        alignItems: 'center',
    },
    topBarContainer: {
        height: 60,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    rightActionsGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    leftGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    clockContainer: {
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E9ECEF',
    },
    clockText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#495057',
        fontFamily: 'monospace',
    },
    leftWrapper: {
        flex: 1,
        marginRight: 15,
        alignItems: 'flex-start',
    },
    rightWrapper: {
        alignItems: 'flex-end',
    },
    pillSelector: {
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    pillText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#37352F',
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
        width: width * 0.45,
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
        width: 65, // Adjusted for single button
        justifyContent: 'center',
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    topActionItem: {
        padding: 4,
    },
    profileCircle: {
        width: 22,
        height: 22,
        borderRadius: 4,
        backgroundColor: '#F7F6F3',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        marginLeft: 4,
    },
    profileInitial: {
        fontSize: 11,
        fontWeight: '700',
        color: '#37352F',
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
