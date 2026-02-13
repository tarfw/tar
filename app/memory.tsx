import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useThemeColors } from '../hooks/use-theme-colors';

/**
 * MEMORY SELECTION SCREEN FOR CREATION
 * Path: app/memory.tsx
 */

interface MemoryItem {
    id: string;
    title: string;
    type?: 'parent' | 'child';
}

interface MemorySection {
    title: string;
    data: MemoryItem[];
}

const MEMORY_DATA: MemorySection[] = [
    {
        title: 'Long-term Memory (LTM)',
        data: [
            { id: 'l1', title: 'Nodes', type: 'parent' },
            { id: 'l2', title: 'Products Catalog', type: 'child' },
            { id: 'l3', title: 'Points', type: 'parent' },
            { id: 'l4', title: 'Inventory Stock Levels', type: 'child' },
            { id: 'l5', title: 'S3', type: 'parent' },
            { id: 'l6', title: 'Finalized Order Archives', type: 'child' },
            { id: 'l7', title: 'Actors', type: 'parent' },
            { id: 'l8', title: 'People', type: 'child' },
            { id: 'l9', title: 'Merchants', type: 'child' },
        ],
    },
    {
        title: 'Short-term Memory (STM)',
        data: [
            { id: 's_or', title: 'OREvents', type: 'parent' },
            // Stock Group
            { id: 's_or_1', title: '🧱 Stock', type: 'parent' },
            { id: 's101', title: 'Stock In', type: 'child' },
            { id: 's102', title: 'Sale Out', type: 'child' },
            { id: 's103', title: 'Sale Return', type: 'child' },
            { id: 's104', title: 'Stock Adjust', type: 'child' },
            { id: 's105', title: 'Stock Transfer Out', type: 'child' },
            { id: 's106', title: 'Stock Transfer In', type: 'child' },
            { id: 's107', title: 'Stock Void', type: 'child' },
            // Invoice Group
            { id: 's_or_2', title: '🧾 Invoice / Billing', type: 'parent' },
            { id: 's201', title: 'Invoice Create', type: 'child' },
            { id: 's202', title: 'Invoice Item Add', type: 'child' },
            { id: 's203', title: 'Invoice Payment', type: 'child' },
            { id: 's204', title: 'Invoice Payment Fail', type: 'child' },
            { id: 's205', title: 'Invoice Void', type: 'child' },
            { id: 's206', title: 'Invoice Item Define', type: 'child' },
            { id: 's207', title: 'Invoice Refund', type: 'child' },
            // Tasks Group
            { id: 's_or_3', title: '🧑💼 Tasks / Workflow', type: 'parent' },
            { id: 's301', title: 'Task Create', type: 'child' },
            { id: 's302', title: 'Task Assign', type: 'child' },
            { id: 's303', title: 'Task Start', type: 'child' },
            { id: 's304', title: 'Task Progress', type: 'child' },
            { id: 's305', title: 'Task Done', type: 'child' },
            { id: 's306', title: 'Task Fail', type: 'child' },
            { id: 's307', title: 'Task Block', type: 'child' },
            { id: 's308', title: 'Task Resume', type: 'child' },
            { id: 's309', title: 'Task Void', type: 'child' },
            { id: 's310', title: 'Task Link', type: 'child' },
            { id: 's311', title: 'Task Comment', type: 'child' },
            // Accounts Group
            { id: 's_or_4', title: '💰 Accounts / Ledger', type: 'parent' },
            { id: 's401', title: 'Account Pay In', type: 'child' },
            { id: 's402', title: 'Account Pay Out', type: 'child' },
            { id: 's403', title: 'Account Refund', type: 'child' },
            { id: 's404', title: 'Account Adjust', type: 'child' },
            // Orders Group
            { id: 's_or_5', title: '🚚 Orders / Delivery', type: 'parent' },
            { id: 's501', title: 'Order Create', type: 'child' },
            { id: 's502', title: 'Order Ship', type: 'child' },
            { id: 's503', title: 'Order Deliver', type: 'child' },
            { id: 's504', title: 'Order Cancel', type: 'child' },
            // Transport Group
            { id: 's_or_6', title: '🚕 Transport / Booking / Rental', type: 'parent' },
            { id: 's601', title: 'Ride Create', type: 'child' },
            { id: 's602', title: 'Ride Start', type: 'child' },
            { id: 's603', title: 'Ride Done', type: 'child' },
            { id: 's604', title: 'Ride Cancel', type: 'child' },
            { id: 's611', title: 'Booking Create', type: 'child' },
            { id: 's612', title: 'Booking Done', type: 'child' },
            { id: 's621', title: 'Rental Start', type: 'child' },
            { id: 's622', title: 'Rental End', type: 'child' },
            // Other STM
            { id: 's_cart', title: 'Current Shopping Cart', type: 'parent' },
            { id: 's_hist', title: 'Recent Order History', type: 'parent' },
            { id: 's_intent', title: 'User Session Intent', type: 'parent' },
            { id: 's_checkout', title: 'Active Checkout State', type: 'parent' },
        ],
    },
];

export default function MemorySelectionScreen() {
    const router = useRouter();
    const colors = useThemeColors();
    const { colorScheme } = useColorScheme();

    const handleSelect = (title: string) => {
        if (title === 'Nodes') {
            router.replace('/add-node');
        } else if (title === 'OREvents') {
            router.replace('/add-event');
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Create Memory</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                    <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            <SectionList
                sections={MEMORY_DATA}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                stickySectionHeadersEnabled={false}
                renderSectionHeader={({ section: { title } }) => (
                    <Text style={[styles.sectionHeader, { color: colors.accent }]}>{title}</Text>
                )}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[
                            styles.memoryItem,
                            item.type === 'child' && styles.childItem,
                            { borderBottomColor: colors.border }
                        ]}
                        onPress={() => handleSelect(item.title)}
                        activeOpacity={0.6}
                    >
                        <Text style={[
                            styles.itemTitle,
                            item.type === 'child' ? [styles.childText, { color: colors.secondaryText }] : [styles.parentText, { color: colors.text }]
                        ]}>
                            {item.title}
                        </Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
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
        fontSize: 18,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
        marginTop: 24,
    },
    memoryItem: {
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    childItem: {
    },
    itemTitle: {
        fontSize: 16,
    },
    parentText: {
        fontWeight: '600',
    },
    childText: {
        fontWeight: '400',
    },
});
