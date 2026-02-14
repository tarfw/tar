import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { dbHelpers } from '../lib/db';
import { ProductPayload, refineProductPayload } from '../lib/groq-service';

/**
 * MEMORY DETAIL SCREEN — Notion-style with AI edit
 */

export default function MemoryDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { title, subtitle, type, ...rest } = params;

    const isProduct = type === 'nodes' && (subtitle === 'Product' || rest.nodetype === 'Product' || rest.nodetype === 'Products');

    const [currentPayload, setCurrentPayload] = useState<any>(() => {
        if (typeof rest.payload === 'string') {
            try { return JSON.parse(rest.payload); } catch { return {}; }
        }
        return {};
    });
    const [currentTitle, setCurrentTitle] = useState(String(title || ''));
    const [currentCode, setCurrentCode] = useState(String(rest.universalcode || ''));

    // AI refine state
    const [refinePrompt, setRefinePrompt] = useState('');
    const [isRefining, setIsRefining] = useState(false);

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=FFFFFF&color=1E3A8A&data=${currentCode || '0000'}`;

    // ─── AI Refine ───
    const handleAiRefine = async () => {
        if (!refinePrompt.trim()) return;
        setIsRefining(true);
        try {
            const payload: ProductPayload = {
                ...currentPayload,
                title: currentTitle,
                universal_code: currentCode,
            };
            const refined = await refineProductPayload(payload, refinePrompt.trim());

            // Update local state
            if (refined.title) setCurrentTitle(refined.title);
            if (refined.universal_code) setCurrentCode(refined.universal_code);

            const { title: _t, universal_code: _uc, ...payloadRest } = refined;
            const newPayload = { ...currentPayload, ...payloadRest };
            setCurrentPayload(newPayload);

            // Persist to database
            const nodeId = String(rest.id || '');
            if (nodeId) {
                await dbHelpers.updateNode(nodeId, {
                    title: refined.title || currentTitle,
                    universalcode: refined.universal_code || currentCode,
                    payload: JSON.stringify(newPayload),
                });
            }

            setRefinePrompt('');
        } catch (e: any) {
            Alert.alert('AI Error', e.message || 'Failed to refine.');
        } finally {
            setIsRefining(false);
        }
    };

    // ─── Property Row ───
    const P = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
        <View style={s.prop}>
            <Text style={s.propIcon}>{icon}</Text>
            <Text style={s.propLabel}>{label}</Text>
            <Text style={s.propValue} numberOfLines={2}>{value}</Text>
        </View>
    );

    // ─── Generic detail rows ───
    const renderDetailRow = (label: string, value: any) => {
        if (value === undefined || value === null || value === '' || label === 'id') return null;
        if (label === 'payload' || label === 'embedding') return null;

        let displayValue = '';
        try {
            displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        } catch { displayValue = 'Error'; }

        return (
            <View key={label} style={s.detailRow}>
                <Text style={s.detailLabel}>{label.replace(/_/g, ' ')}</Text>
                <Text style={s.detailValue}>{displayValue}</Text>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={s.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <StatusBar barStyle="dark-content" />

            {/* ── Top Bar ── */}
            <View style={s.topBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                {isProduct && (
                    <View style={s.typeBadge}>
                        <Text style={s.typeBadgeText}>{String(rest.nodetype || 'Product')}</Text>
                    </View>
                )}
            </View>

            <ScrollView
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Title ── */}
                <Text style={s.title}>{currentTitle || 'Untitled'}</Text>

                {/* ── Universal Code ── */}
                {currentCode ? (
                    <View style={s.codeRow}>
                        <MaterialCommunityIcons name="barcode-scan" size={14} color="#7C3AED" />
                        <Text style={s.codeText}>{currentCode}</Text>
                    </View>
                ) : null}

                <View style={s.divider} />

                {isProduct ? (
                    <>
                        {/* ──────── PROPERTIES TABLE ──────── */}
                        <View style={s.propTable}>
                            {currentPayload.brand && <P icon="🏷️" label="Brand" value={currentPayload.brand} />}
                            {currentPayload.price?.amount != null && (
                                <P
                                    icon="💰"
                                    label="Price"
                                    value={`${currentPayload.price.currency || 'USD'} ${currentPayload.price.amount}${currentPayload.price.range ? `  (${currentPayload.price.range})` : ''}`}
                                />
                            )}
                            {currentPayload.availability && (
                                <View style={s.prop}>
                                    <Text style={s.propIcon}>📦</Text>
                                    <Text style={s.propLabel}>Status</Text>
                                    <View style={s.statusPill}>
                                        <View style={[
                                            s.statusDot,
                                            { backgroundColor: currentPayload.availability.toLowerCase().includes('stock') ? '#22C55E' : '#F59E0B' }
                                        ]} />
                                        <Text style={s.statusText}>{currentPayload.availability}</Text>
                                    </View>
                                </View>
                            )}
                            {currentPayload.categorization?.category && (
                                <P
                                    icon="📂"
                                    label="Category"
                                    value={`${currentPayload.categorization.category}${currentPayload.categorization.subcategory ? ' › ' + currentPayload.categorization.subcategory : ''}`}
                                />
                            )}
                            {currentPayload.gtin && <P icon="📊" label="GTIN" value={currentPayload.gtin} />}
                            {currentPayload.mpn && <P icon="🔢" label="MPN" value={currentPayload.mpn} />}
                            {currentPayload.delivery && <P icon="🚚" label="Delivery" value={currentPayload.delivery} />}
                            {currentPayload.return_policy && <P icon="↩️" label="Returns" value={currentPayload.return_policy} />}
                        </View>

                        {/* ──────── TAGS ──────── */}
                        {currentPayload.categorization?.tags && currentPayload.categorization.tags.length > 0 && (
                            <View style={s.section}>
                                <Text style={s.sectionTitle}>Tags</Text>
                                <View style={s.tagsRow}>
                                    {currentPayload.categorization.tags.map((tag: string, i: number) => (
                                        <View key={i} style={s.tag}>
                                            <Text style={s.tagText}>{tag}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* ──────── DESCRIPTION ──────── */}
                        {currentPayload.description && (
                            <View style={s.section}>
                                <Text style={s.sectionTitle}>Description</Text>
                                <Text style={s.descText}>{currentPayload.description}</Text>
                            </View>
                        )}

                        {/* ──────── OPTIONS ──────── */}
                        {currentPayload.options && Array.isArray(currentPayload.options) && currentPayload.options.length > 0 && (
                            <View style={s.section}>
                                <Text style={s.sectionTitle}>Options</Text>
                                {currentPayload.options.map((opt: any, idx: number) => (
                                    <View key={idx} style={s.optGroup}>
                                        <Text style={s.optName}>{opt.name}</Text>
                                        <View style={s.optValuesRow}>
                                            {opt.values?.map((val: string, vi: number) => (
                                                <View key={vi} style={s.optChip}>
                                                    <Text style={s.optChipText}>{val}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* ──────── SPECIFICATIONS ──────── */}
                        {currentPayload.specifications && typeof currentPayload.specifications === 'object' && Object.keys(currentPayload.specifications).length > 0 && (
                            <View style={s.section}>
                                <Text style={s.sectionTitle}>Specifications</Text>
                                <View style={s.specTable}>
                                    {Object.entries(currentPayload.specifications).map(([k, v], i) => (
                                        <View key={i} style={s.specRow}>
                                            <Text style={s.specKey}>{k}</Text>
                                            <Text style={s.specVal}>{String(v)}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* ──────── PRODUCT IMAGE ──────── */}
                        {(currentPayload?.image || currentPayload?.images?.[0]) && (
                            <View style={s.section}>
                                <Text style={s.sectionTitle}>Image</Text>
                                <View style={s.imageContainer}>
                                    <Image
                                        source={{ uri: currentPayload.image || currentPayload.images[0] }}
                                        style={s.image}
                                        contentFit="cover"
                                    />
                                </View>
                            </View>
                        )}

                        {/* ──────── QR CODE ──────── */}
                        {currentCode ? (
                            <View style={s.section}>
                                <Text style={s.sectionTitle}>QR Code</Text>
                                <View style={s.qrWrap}>
                                    <Image source={{ uri: qrCodeUrl }} style={s.qrImage} contentFit="contain" />
                                    <Text style={s.qrLabel}>{currentCode}</Text>
                                </View>
                            </View>
                        ) : null}
                    </>
                ) : (
                    <View>
                        {Object.entries(rest).map(([key, value]) => renderDetailRow(key, value))}
                    </View>
                )}

                {/* Spacer for refine bar */}
                <View style={{ height: 80 }} />
            </ScrollView>

            {/* ── AI Refine Bar (sticky bottom) ── */}
            {isProduct && (
                <View style={s.refineBarOuter}>
                    <View style={s.refineBar}>
                        <MaterialCommunityIcons name="creation" size={18} color="#A78BFA" style={{ marginRight: 8 }} />
                        <TextInput
                            style={s.refineInput}
                            placeholder="Edit with AI — e.g. change price to $250..."
                            placeholderTextColor="#CBD5E1"
                            value={refinePrompt}
                            onChangeText={setRefinePrompt}
                            onSubmitEditing={handleAiRefine}
                            returnKeyType="send"
                            editable={!isRefining}
                        />
                        {refinePrompt.trim().length > 0 || isRefining ? (
                            <TouchableOpacity
                                style={[s.refineSend, isRefining && { opacity: 0.4 }]}
                                onPress={handleAiRefine}
                                disabled={isRefining}
                            >
                                {isRefining ? (
                                    <ActivityIndicator color="#7C3AED" size="small" />
                                ) : (
                                    <MaterialCommunityIcons name="arrow-up-circle" size={30} color="#7C3AED" />
                                )}
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
            )}
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    typeBadge: {
        backgroundColor: '#F3F0FF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 5,
    },
    typeBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#7C3AED',
    },

    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 20,
    },

    // ── Title ──
    title: {
        fontSize: 30,
        fontWeight: '700',
        color: '#111827',
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
        marginBottom: 4,
    },
    codeText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#7C3AED',
        letterSpacing: 0.5,
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 16,
    },

    // ── Properties Table ──
    propTable: {
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    prop: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 8,
    },
    propIcon: { fontSize: 14, width: 22 },
    propLabel: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', width: 80 },
    propValue: { flex: 1, fontSize: 14, fontWeight: '500', color: '#374151' },

    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        textTransform: 'capitalize',
    },

    // ── Sections ──
    section: {
        paddingTop: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 10,
    },

    // Tags
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: {
        backgroundColor: '#F3F0FF',
        borderRadius: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    tagText: { fontSize: 13, fontWeight: '500', color: '#7C3AED' },

    // Description
    descText: { fontSize: 15, color: '#4B5563', lineHeight: 24 },

    // Options
    optGroup: { marginBottom: 14 },
    optName: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
    optValuesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    optChip: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    optChipText: { fontSize: 13, fontWeight: '500', color: '#374151' },

    // Specifications Table
    specTable: {
        borderWidth: 1,
        borderColor: '#F3F4F6',
        borderRadius: 8,
        overflow: 'hidden',
    },
    specRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#F3F4F6',
    },
    specKey: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', width: 120 },
    specVal: { flex: 1, fontSize: 13, fontWeight: '500', color: '#374151' },

    // Image
    imageContainer: { borderRadius: 12, overflow: 'hidden' },
    image: { width: '100%', aspectRatio: 1.5 },

    // QR Code
    qrWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        padding: 16,
        backgroundColor: '#FAFAFA',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    qrImage: { width: 72, height: 72, borderRadius: 4 },
    qrLabel: { fontSize: 16, fontWeight: '700', color: '#374151', letterSpacing: 0.5 },

    // Generic Detail Rows
    detailRow: { marginBottom: 24 },
    detailLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94A3B8',
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    detailValue: { fontSize: 16, fontWeight: '500', color: '#1E293B' },

    // ── AI Refine Bar ──
    refineBarOuter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingBottom: Platform.OS === 'ios' ? 28 : 12,
        paddingTop: 8,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    refineBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E9E5F5',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: '#FAFAFF',
    },
    refineInput: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
        paddingVertical: 2,
    },
    refineSend: {
        marginLeft: 6,
    },
});
