import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Platform, SafeAreaView, SectionList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMemoryStore } from '../hooks/use-memory-store';

/**
 * STRICT COMMERCE MEMORY CLASSIFICATION
 * Categories: LTM, STM, WM
 * Entities: Products, Inventory, Orders, Cart
 */

const COMMERCE_MEMORY = [
    {
        title: 'Long-term Memory (LTM)',
        data: [
            { id: 'l1', title: 'Products Catalog' },
            { id: 'l2', title: 'Inventory Stock Levels' },
            { id: 'l3', title: 'Finalized Orders Archive' },
            { id: 'l4', title: 'Global Compliance Rules' },
        ],
    },
    {
        title: 'Short-term Memory (STM)',
        data: [
            { id: 's1', title: 'Current Shopping Cart' },
            { id: 's2', title: 'Recent Order History' },
            { id: 's3', title: 'User Session Intent' },
            { id: 's4', title: 'Active Checkout State' },
        ],
    },
    {
        title: 'Working Memory (WM)',
        data: [
            { id: 'w1', title: 'Active Order Processing' },
            { id: 'w2', title: 'Real-time Tax Logic' },
            { id: 'w3', title: 'Promo Code Verification' },
            { id: 'w4', title: 'Shipping Fee Calculation' },
        ],
    },
];

export default function MemoryScreen() {
    const router = useRouter();
    const { setMemory } = useMemoryStore();

    const handleSelect = (title: string) => {
        setMemory(title);
        router.back();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Commerce Memories</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                    <MaterialCommunityIcons name="close" size={24} color="#000" />
                </TouchableOpacity>
            </View>

            <SectionList
                sections={COMMERCE_MEMORY}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                stickySectionHeadersEnabled={false}
                renderSectionHeader={({ section: { title } }) => (
                    <Text style={styles.sectionHeader}>{title}</Text>
                )}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.memoryItem}
                        onPress={() => handleSelect(item.title)}
                        activeOpacity={0.6}
                    >
                        <Text style={styles.itemTitle}>{item.title}</Text>
                    </TouchableOpacity>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#000',
        letterSpacing: -0.5,
    },
    closeButton: {
        padding: 5,
    },
    listContent: {
        padding: 20,
        paddingBottom: 40,
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: '700',
        color: '#006AFF', // Square Blue for headers
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
        marginTop: 24,
    },
    memoryItem: {
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#f0f0f0',
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1a1a1a',
    },
});
