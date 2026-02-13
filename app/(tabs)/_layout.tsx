import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMemoryStore } from '../../hooks/use-memory-store';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { TABLES } from '../../lib/constants';
import { syncDb } from '../../lib/db';



const { width } = Dimensions.get('window');

function CustomTabBar({ state, descriptors, navigation }: any) {
    const { memory, setMemory } = useMemoryStore();
    const router = useRouter();
    const pathname = usePathname();
    const colors = useThemeColors();
    const { colorScheme } = useColorScheme();
    const [isFilterModalVisible, setIsFilterModalVisible] = React.useState(false);


    const activeTable = TABLES.find(t => t.id === memory);
    const memoryDisplayName = activeTable ? activeTable.name : (memory === 'Memory' ? 'Memory' : memory);

    return (
        <View style={styles.tabBarContainer}>
            <View style={styles.leftWrapper}>
                <BlurView intensity={90} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={[styles.tabBarInner, { backgroundColor: colors.tabBarBackground, borderColor: colors.border }]}>

                    {state.routes
                        .filter((route: any) => route.name !== 'relay')
                        .map((route: any, index: number) => {
                            const isFocused = state.index === index;

                            const onPress = () => {
                                if (route.name === 'index' && isFocused) {
                                    setIsFilterModalVisible(true);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    return;
                                }

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
                            let IconComponent: any = MaterialCommunityIcons;

                            if (route.name === 'index') {
                                // Home / Trace tab: show active memory icon
                                iconName = activeTable?.icon || 'clock-outline';
                            }

                            return (
                                <TouchableOpacity
                                    key={route.name}
                                    onPress={onPress}
                                    style={styles.tabItem}
                                    activeOpacity={0.7}
                                >
                                    <IconComponent
                                        name={iconName as any}
                                        size={28}
                                        color={isFocused ? '#006AFF' : '#8E8E93'}
                                    />
                                </TouchableOpacity>
                            );
                        })}

                </BlurView>

                <Modal
                    visible={isFilterModalVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setIsFilterModalVisible(false)}
                >
                    <Pressable
                        style={styles.modalOverlayBottom}
                        onPress={() => setIsFilterModalVisible(false)}
                    >
                        <View style={[styles.dropdownMenuBottom, { backgroundColor: colors.dropdownBackground }]}>

                            <FlatList
                                data={TABLES}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => {
                                    const isActive = memory === item.id;
                                    return (
                                        <TouchableOpacity
                                            style={[
                                                styles.dropdownItem,
                                                isActive && { backgroundColor: colorScheme === 'dark' ? 'rgba(94, 106, 210, 0.25)' : 'rgba(94, 106, 210, 0.15)' }
                                            ]}
                                            onPress={() => {
                                                setMemory(item.id);
                                                setIsFilterModalVisible(false);
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            }}
                                        >
                                            <MaterialCommunityIcons
                                                name={item.icon as any}
                                                size={18}
                                                color={isActive ? (colorScheme === 'dark' ? '#8B8EF8' : '#5E6AD2') : colors.secondaryText}
                                                style={{ marginRight: 10 }}
                                            />
                                            <Text style={[
                                                styles.dropdownItemText,
                                                { color: colors.text },
                                                isActive && { color: colorScheme === 'dark' ? '#8B8EF8' : '#5E6AD2', fontWeight: '600' }
                                            ]}>
                                                {item.name}
                                            </Text>
                                        </TouchableOpacity>

                                    );
                                }}
                            />
                        </View>
                    </Pressable>
                </Modal>
            </View>

            <View style={styles.rightWrapper}>
                <BlurView intensity={90} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={[styles.rightContainer, { backgroundColor: colors.tabBarBackground, borderColor: colors.border }]}>
                    <TouchableOpacity
                        style={[styles.actionItem, styles.addButton, { backgroundColor: colors.accent }]}

                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push('/memory');
                        }}

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
    const router = useRouter();
    const pathname = usePathname();
    const colors = useThemeColors();
    const { colorScheme, setColorScheme } = useColorScheme();

    const handleSync = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await syncDb();
    };

    const toggleTheme = () => {
        const nextScheme = colorScheme === 'dark' ? 'light' : 'dark';
        setColorScheme(nextScheme);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const isAgentsScreen = pathname === '/agents';

    return (
        <View style={[styles.topBarContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <View style={styles.leftGroup}>
                <TouchableOpacity
                    style={styles.topActionItem}
                    onPress={toggleTheme}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons
                        name={colorScheme === 'dark' ? "weather-sunny" : "weather-night"}
                        size={20}
                        color={colors.text}
                    />
                </TouchableOpacity>
            </View>

            <View style={styles.rightActionsGroup}>
                {!isAgentsScreen && (
                    <TouchableOpacity
                        style={styles.topActionItem}
                        onPress={handleSync}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="brain" size={20} color={colors.text} />
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={styles.topActionItem}
                    onPress={() => router.push('/relay')}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons name="asterisk" size={20} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.profileCircle, { backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#F7F6F3', borderColor: colors.border }]}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.profileInitial, { color: colors.text }]}>A</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function TabLayout() {
    const colors = useThemeColors();
    const { colorScheme } = useColorScheme();

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <TopBar />

            <Tabs
                tabBar={(props) => <CustomTabBar {...props} />}
                screenOptions={{
                    headerShown: false,
                    tabBarShowLabel: false,
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        headerTitle: 'Trace',
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
    leftWrapper: {
        flex: 1,
        marginRight: 15,
        alignItems: 'flex-start',
    },
    rightWrapper: {
        alignItems: 'flex-end',
    },
    tabBarInner: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 35,
        height: 65,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        paddingHorizontal: 0,
        width: 100,
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
        width: 100,
        justifyContent: 'center',
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(0,0,0,0.05)',
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
    modalOverlayBottom: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
        paddingBottom: 110,
        paddingHorizontal: 16,
    },
    dropdownMenuBottom: {
        backgroundColor: '#1F2023',
        borderRadius: 10,
        paddingVertical: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
        maxHeight: 400,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginHorizontal: 4,
        borderRadius: 6,
    },
    dropdownItemActive: {
        backgroundColor: 'rgba(94, 106, 210, 0.15)',
    },
    dropdownItemText: {
        fontSize: 14,
        color: '#E8E9EB',
        fontWeight: '500',
    },
    dropdownItemTextActive: {
        color: '#8B8EF8',
        fontWeight: '600',
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
});
