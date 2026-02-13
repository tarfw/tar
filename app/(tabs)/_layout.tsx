import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Tabs, usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMemoryStore } from '../../hooks/use-memory-store';
import { TABLES } from '../../lib/constants';
import { syncDb } from '../../lib/db';

const { width } = Dimensions.get('window');

function CustomTabBar({ state, descriptors, navigation }: any) {
    const { memory, setMemory } = useMemoryStore();
    const router = useRouter();
    const pathname = usePathname();
    const [isFilterModalVisible, setIsFilterModalVisible] = React.useState(false);

    const activeTable = TABLES.find(t => t.id === memory);
    const memoryDisplayName = activeTable ? activeTable.name : (memory === 'Memory' ? 'Memory' : memory);

    return (
        <View style={styles.tabBarContainer}>
            <View style={styles.leftWrapper}>
                <BlurView intensity={90} tint="light" style={styles.tabBarInner}>
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
                            } else if (route.name === 'agents') {
                                iconName = 'square-rounded-outline';
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
                        <View style={styles.dropdownMenuBottom}>
                            <Text style={styles.dropdownHeader}>Filter Memory</Text>
                            <FlatList
                                data={TABLES}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.dropdownItem,
                                            memory === item.id && styles.dropdownItemActive
                                        ]}
                                        onPress={() => {
                                            setMemory(item.id);
                                            setIsFilterModalVisible(false);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                    >
                                        <MaterialCommunityIcons
                                            name={item.icon as any}
                                            size={20}
                                            color={memory === item.id ? '#006AFF' : '#636366'}
                                            style={{ marginRight: 12 }}
                                        />
                                        <Text style={[
                                            styles.dropdownItemText,
                                            memory === item.id && styles.dropdownItemTextActive
                                        ]}>
                                            {item.name}
                                        </Text>
                                        {memory === item.id && (
                                            <MaterialCommunityIcons name="check" size={18} color="#006AFF" style={{ marginLeft: 'auto' }} />
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </Pressable>
                </Modal>
            </View>

            <View style={styles.rightWrapper}>
                <BlurView intensity={90} tint="light" style={styles.rightContainer}>
                    <TouchableOpacity
                        style={[styles.actionItem, styles.addButton]}
                        onPress={() => {
                            // Logic for add button if needed, or just stay as plus
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

    const handleSync = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await syncDb();
    };

    const isAgentsScreen = pathname === '/agents';

    return (
        <View style={styles.topBarContainer}>
            <View style={styles.leftGroup}>
                {/* Clean top bar left section */}
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
                    name="index"
                    options={{
                        headerTitle: 'Trace',
                    }}
                />
                <Tabs.Screen
                    name="agents"
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
        justifyContent: 'space-evenly',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        paddingHorizontal: 10,
        minWidth: 180,
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
        width: 65,
        justifyContent: 'center',
    },
    tabItem: {
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minWidth: 50,
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
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'flex-end',
        paddingBottom: 110,
        paddingHorizontal: 16,
    },
    dropdownMenuBottom: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        maxHeight: 400,
    },
    dropdownHeader: {
        fontSize: 12,
        fontWeight: '700',
        color: '#8E8E93',
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#F2F2F7',
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
    },
    dropdownItemActive: {
        backgroundColor: '#F0F7FF',
    },
    dropdownItemText: {
        fontSize: 16,
        color: '#1C1C1E',
        fontWeight: '500',
    },
    dropdownItemTextActive: {
        color: '#006AFF',
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
