import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';

/**
 * MEMORY DETAIL SCREEN (mstate.tsx)
 * Redesigned: Dark card with vibrant green accent for Products.
 */

export default function MemoryDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Parse the item data from params
    const { title, subtitle, type, ...rest } = params;

    // Check if this is a Product node
    const isProduct = type === 'nodes' && (subtitle === 'Product' || rest.nodetype === 'Product');

    // Parse payload if available to get image
    const payloadData = useMemo(() => {
        if (typeof rest.payload === 'string') {
            try {
                return JSON.parse(rest.payload);
            } catch (e) {
                return {};
            }
        }
        return {};
    }, [rest.payload]);

    const renderDetailRow = (label: string, value: any) => {
        if (value === undefined || value === null || value === '' || label === 'id') return null;
        if (label === 'payload' || label === 'embedding') return null;
        if (isProduct && (label === 'universalcode' || label === 'nodetype' || label === 'title')) return null;

        let displayValue = '';
        try {
            if (typeof value === 'object') {
                displayValue = JSON.stringify(value);
            } else {
                displayValue = String(value);
            }
        } catch (e) {
            displayValue = 'Error displaying value';
        }

        return (
            <View key={label} style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                    {String(label).replace(/_/g, ' ')}
                </Text>
                <Text style={styles.detailValue}>
                    {displayValue}
                </Text>
            </View>
        );
    };

    const renderProductCard = () => {
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=FFFFFF&color=1E3A8A&data=${rest.universalcode || '0000'}`;

        return (
            <View style={styles.productCard}>
                {/* Green glow border */}
                <View style={styles.productCardInner}>
                    {/* Top Section: Type label */}
                    <View style={styles.cardTopRow}>
                        <Text style={styles.cardTypeLabel}>
                            {String(subtitle || rest.nodetype || 'Product')}
                        </Text>
                        <Text style={styles.cardTitle}>
                            {title || 'Unknown Product'}
                        </Text>
                    </View>

                    {/* Middle Section: Product Image */}
                    <View style={styles.cardImageContainer}>
                        {payloadData?.image ? (
                            <Image
                                source={{ uri: payloadData.image }}
                                style={styles.cardImage}
                                contentFit="cover"
                            />
                        ) : (
                            <Image
                                source={require('../assets/images/prod1.jpg')}
                                style={styles.cardImage}
                                contentFit="cover"
                            />
                        )}
                    </View>

                    {/* Bottom Section: Universal Code + QR */}
                    <View style={styles.cardBottomRow}>
                        <View style={styles.cardBottomLeft}>
                            <Text style={styles.cardBottomLabel}>Universal Code</Text>
                            <Text style={styles.cardBottomValue}>
                                {String(rest.universalcode || '---')}
                            </Text>
                        </View>
                        <View style={styles.qrContainer}>
                            <Image
                                source={{ uri: qrCodeUrl }}
                                style={styles.qrImage}
                                contentFit="contain"
                            />
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />



            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                {isProduct ? (
                    <View style={styles.cardWrapper}>
                        {renderProductCard()}
                    </View>
                ) : (
                    /* Default Hero Section */
                    <View style={styles.heroSection}>
                        <View style={styles.heroIcon}>
                            <MaterialCommunityIcons
                                name={(type === 'actor' || type === 'actors') ? 'account-outline' : 'database-outline'}
                                size={32}
                                color="#3B82F6"
                            />
                        </View>
                        <Text style={styles.heroTitle}>
                            {title || 'Unknown Entity'}
                        </Text>
                        <View style={styles.heroBadgeRow}>
                            <View style={styles.heroBadge}>
                                <Text style={styles.heroBadgeText}>
                                    {String(type || 'node')}
                                </Text>
                            </View>
                            <Text style={styles.heroSubtitle}>{subtitle}</Text>
                        </View>
                    </View>
                )}

                {/* Content / Details */}
                <View style={styles.detailsContainer}>
                    {!isProduct && <View style={styles.divider} />}
                    <View>
                        {Object.entries(rest).map(([key, value]) => renderDetailRow(key, value))}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },

    cardWrapper: {
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    // --- Product Card (Blue + White accent) ---
    productCard: {
        width: '100%',
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        padding: 3,
        marginBottom: 8,
    },
    productCardInner: {
        width: '100%',
        borderRadius: 26,
        backgroundColor: '#1E3A8A',
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 24,
        minHeight: 420,
        justifyContent: 'space-between',
    },
    cardTopRow: {
        marginBottom: 20,
    },
    cardTypeLabel: {
        fontSize: 14,
        fontWeight: '400',
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    cardTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    cardImageContainer: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },

    cardBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    cardBottomLeft: {
        flex: 1,
    },
    cardBottomLabel: {
        fontSize: 12,
        fontWeight: '400',
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 4,
    },
    cardBottomValue: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    qrContainer: {
        width: 64,
        height: 64,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        padding: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qrImage: {
        width: 56,
        height: 56,
        borderRadius: 4,
    },
    // --- Default Hero ---
    heroSection: {
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 32,
    },
    heroIcon: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    heroTitle: {
        fontSize: 30,
        fontWeight: '700',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    heroBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    heroBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: '#F1F5F9',
        marginRight: 8,
    },
    heroBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: -0.5,
    },
    heroSubtitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#94A3B8',
    },
    // --- Details ---
    detailsContainer: {
        paddingHorizontal: 24,
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        width: 48,
        marginBottom: 32,
    },
    detailRow: {
        marginBottom: 24,
    },
    detailLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94A3B8',
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1E293B',
    },
});
