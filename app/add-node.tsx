import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { dbHelpers } from '../lib/db';
import {
    generateProductPayload,
    getGroqApiKey,
    ProductPayload
} from '../lib/groq-service';

type EntryMode = 'form' | 'ai';

export default function AddNodeScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const initialType = typeof params.type === 'string' ? params.type : 'Products';

    // Check if type is fixed from navigation params
    const isTypeFixed = typeof params.type === 'string';

    // Core node fields
    const [title, setTitle] = useState('');
    const [nodeType, setNodeType] = useState(initialType);
    const [universalCode, setUniversalCode] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Product form fields
    const [brand, setBrand] = useState('');
    const [description, setDescription] = useState('');
    const [availability, setAvailability] = useState('in stock');
    const [priceAmount, setPriceAmount] = useState('');
    const [priceCurrency, setPriceCurrency] = useState('USD');
    const [priceRange, setPriceRange] = useState('');
    const [gtin, setGtin] = useState('');
    const [mpn, setMpn] = useState('');
    const [category, setCategory] = useState('');
    const [subcategory, setSubcategory] = useState('');
    const [tags, setTags] = useState('');
    const [delivery, setDelivery] = useState('');
    const [returnPolicy, setReturnPolicy] = useState('');
    const [specsRaw, setSpecsRaw] = useState('');
    const [optionsRaw, setOptionsRaw] = useState('');

    // Collections form fields
    const [collectionDescription, setCollectionDescription] = useState('');
    const [collectionTags, setCollectionTags] = useState('');

    // Options form fields
    const [optionValues, setOptionValues] = useState('');

    // Group form fields
    const [groupDescription, setGroupDescription] = useState('');
    const [groupMembers, setGroupMembers] = useState('');

    // AI mode
    const [entryMode, setEntryMode] = useState<EntryMode>('form');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [hasApiKey, setHasApiKey] = useState(false);

    useEffect(() => {
        getGroqApiKey().then((k) => setHasApiKey(!!k));
    }, []);

    // Build payload JSON from form fields
    const buildPayload = (): string => {
        const payload: ProductPayload = {};

        if (description.trim()) payload.description = description.trim();
        if (brand.trim()) payload.brand = brand.trim();
        if (gtin.trim()) payload.gtin = gtin.trim();
        if (mpn.trim()) payload.mpn = mpn.trim();
        if (availability) payload.availability = availability;

        if (priceAmount.trim()) {
            payload.price = {
                amount: parseFloat(priceAmount),
                currency: priceCurrency || 'USD',
            };
            if (priceRange.trim()) payload.price.range = priceRange.trim();
        }

        if (category.trim()) {
            payload.categorization = { category: category.trim() };
            if (subcategory.trim()) payload.categorization.subcategory = subcategory.trim();
            if (tags.trim()) {
                payload.categorization.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
            }
        }

        if (optionsRaw.trim()) {
            payload.options = optionsRaw.split('|').map(group => {
                const [name, ...vals] = group.split(':');
                return {
                    name: name?.trim() || '',
                    values: vals.join(':').split(',').map(v => v.trim()).filter(Boolean),
                };
            }).filter(o => o.name);
        }

        if (specsRaw.trim()) {
            payload.specifications = {};
            specsRaw.split(',').forEach(pair => {
                const [k, ...v] = pair.split(':');
                if (k?.trim() && v.length) {
                    payload.specifications![k.trim()] = v.join(':').trim();
                }
            });
        }

        if (delivery.trim()) payload.delivery = delivery.trim();
        if (returnPolicy.trim()) payload.return_policy = returnPolicy.trim();

        return JSON.stringify(payload);
    };

    // Populate form from AI-generated payload
    const populateFromPayload = (p: ProductPayload) => {
        if (p.description) setDescription(p.description);
        if (p.brand) setBrand(p.brand);
        if (p.gtin) setGtin(p.gtin);
        if (p.mpn) setMpn(p.mpn);
        if (p.availability) setAvailability(p.availability);

        if (p.price) {
            if (p.price.amount != null) setPriceAmount(String(p.price.amount));
            if (p.price.currency) setPriceCurrency(p.price.currency);
            if (p.price.range) setPriceRange(p.price.range);
        }

        if (p.categorization) {
            if (p.categorization.category) setCategory(p.categorization.category);
            if (p.categorization.subcategory) setSubcategory(p.categorization.subcategory);
            if (p.categorization.tags) setTags(p.categorization.tags.join(', '));
        }

        if (p.options?.length) {
            setOptionsRaw(p.options.map(o => `${o.name}: ${o.values.join(', ')}`).join(' | '));
        }

        if (p.specifications) {
            setSpecsRaw(Object.entries(p.specifications).map(([k, v]) => `${k}: ${v}`).join(', '));
        }

        if (p.delivery) setDelivery(p.delivery);
        if (p.return_policy) setReturnPolicy(p.return_policy);

        // Auto-switch to form mode so user can review
        setEntryMode('form');
    };

    const handleAiGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setIsGenerating(true);
        try {
            const payload = await generateProductPayload(aiPrompt.trim());
            populateFromPayload(payload);
            // Try to infer title from description if empty
            if (!title.trim() && payload.brand && payload.description) {
                setTitle(`${payload.brand} ${payload.description.substring(0, 30)}`.trim());
            }
        } catch (e: any) {
            Alert.alert('AI Error', e.message || 'Failed to generate product data.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!title.trim() || !universalCode.trim()) {
            Alert.alert('Missing Fields', 'Please fill in Title and Universal Code.');
            return;
        }

        setIsSaving(true);
        try {
            const payloadStr = buildPayload();
            const newNode = {
                id: Math.random().toString(36).substring(7),
                title: title.trim(),
                nodetype: nodeType,
                universalcode: universalCode.trim(),
                payload: payloadStr !== '{}' ? payloadStr : undefined,
            };

            await dbHelpers.insertNode(newNode);
            router.back();
        } catch (error) {
            console.error('Failed to save node:', error);
            Alert.alert('Error', 'Error saving node. Check console.');
        } finally {
            setIsSaving(false);
        }
    };

    const renderFormField = (
        label: string,
        value: string,
        setter: (v: string) => void,
        placeholder: string,
        multiline = false
    ) => (
        <View style={styles.field}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
                style={[styles.fieldInput, multiline && styles.fieldMultiline]}
                placeholder={placeholder}
                placeholderTextColor="#C9CDD3"
                value={value}
                onChangeText={setter}
                multiline={multiline}
            />
        </View>
    );

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add {isTypeFixed ? nodeType.slice(0, -1) : 'Node'}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                {/* Core fields */}
                {renderFormField(
                    nodeType === 'Collections' ? 'Collection Name' :
                        nodeType === 'Options' ? 'Option Name' :
                            nodeType === 'Group' ? 'Group Name' : 'Title',
                    title,
                    setTitle,
                    nodeType === 'Collections' ? 'e.g. Summer Sale' :
                        nodeType === 'Options' ? 'e.g. Size, Color' :
                            nodeType === 'Group' ? 'e.g. Electronics Bundle' : 'e.g. Smart LED Bulb'
                )}

                <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Node Type</Text>
                    <View style={styles.typeContainer}>
                        {isTypeFixed ? (
                            <TouchableOpacity
                                style={[styles.typeBtn, styles.typeBtnActive, { flex: 0, paddingHorizontal: 24 }]}
                                disabled={true}
                            >
                                <Text style={[styles.typeBtnText, styles.typeBtnTextActive]}>
                                    {nodeType}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            ['Products', 'Collections', 'Options', 'Group'].map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.typeBtn, nodeType === type && styles.typeBtnActive]}
                                    onPress={() => setNodeType(type)}
                                >
                                    <Text style={[styles.typeBtnText, nodeType === type && styles.typeBtnTextActive]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </View>

                {renderFormField('Universal Code', universalCode, setUniversalCode, 'e.g. PROD-12345')}

                {/* Entry mode toggle */}
                <View style={styles.modeToggle}>
                    <TouchableOpacity
                        style={[styles.modeBtn, entryMode === 'form' && styles.modeBtnActive]}
                        onPress={() => setEntryMode('form')}
                    >
                        <MaterialCommunityIcons
                            name="form-textbox"
                            size={16}
                            color={entryMode === 'form' ? '#FFF' : '#9CA3AF'}
                        />
                        <Text style={[styles.modeBtnText, entryMode === 'form' && styles.modeBtnTextActive]}>
                            Form
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeBtn, entryMode === 'ai' && styles.modeBtnActive]}
                        onPress={() => setEntryMode('ai')}
                    >
                        <MaterialCommunityIcons
                            name="auto-fix"
                            size={16}
                            color={entryMode === 'ai' ? '#FFF' : '#9CA3AF'}
                        />
                        <Text style={[styles.modeBtnText, entryMode === 'ai' && styles.modeBtnTextActive]}>
                            AI Fill
                        </Text>
                    </TouchableOpacity>
                </View>

                {entryMode === 'ai' ? (
                    /* ─── AI Mode ─── */
                    <View style={styles.aiSection}>
                        <Text style={styles.aiHint}>
                            Describe your product in plain language. AI will fill in the form for you.
                        </Text>
                        <TextInput
                            style={[styles.fieldInput, styles.aiInput]}
                            placeholder="e.g. Red Nike Air Max 90, sizes 8-12, $120, leather, ships in 3 days"
                            placeholderTextColor="#C9CDD3"
                            value={aiPrompt}
                            onChangeText={setAiPrompt}
                            multiline
                        />
                        <TouchableOpacity
                            style={[styles.aiBtn, isGenerating && { opacity: 0.6 }]}
                            onPress={handleAiGenerate}
                            disabled={isGenerating || !aiPrompt.trim()}
                        >
                            {isGenerating ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="auto-fix" size={18} color="#FFF" />
                                    <Text style={styles.aiBtnText}>Generate</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        {!hasApiKey && (
                            <Text style={styles.aiWarning}>
                                ⚠ No API key set. Tap below to add one.
                            </Text>
                        )}
                    </View>
                ) : (
                    /* ─── Form Mode ─── */
                    <View style={styles.formSections}>
                        {nodeType === 'Products' && (
                            <>
                                {/* Basic */}
                                <Text style={styles.sectionLabel}>Basic</Text>
                                {renderFormField('Brand', brand, setBrand, 'e.g. Nike')}
                                {renderFormField('Description', description, setDescription, 'Product description...', true)}

                                <View style={styles.field}>
                                    <Text style={styles.fieldLabel}>Availability</Text>
                                    <View style={styles.typeContainer}>
                                        {['in stock', 'out of stock', 'preorder'].map((a) => (
                                            <TouchableOpacity
                                                key={a}
                                                style={[styles.typeBtn, availability === a && styles.typeBtnActive]}
                                                onPress={() => setAvailability(a)}
                                            >
                                                <Text style={[styles.typeBtnText, availability === a && styles.typeBtnTextActive]}>
                                                    {a}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Pricing */}
                                <Text style={styles.sectionLabel}>Pricing</Text>
                                <View style={styles.fieldRow}>
                                    <View style={{ flex: 2 }}>
                                        {renderFormField('Amount', priceAmount, setPriceAmount, '49.99')}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        {renderFormField('Currency', priceCurrency, setPriceCurrency, 'USD')}
                                    </View>
                                </View>
                                {renderFormField('Range', priceRange, setPriceRange, 'e.g. $40 - $60')}

                                {/* Identifiers */}
                                <Text style={styles.sectionLabel}>Identifiers</Text>
                                {renderFormField('GTIN', gtin, setGtin, 'EAN / UPC barcode')}
                                {renderFormField('MPN', mpn, setMpn, 'Manufacturer Part Number')}

                                {/* Category */}
                                <Text style={styles.sectionLabel}>Category</Text>
                                {renderFormField('Category', category, setCategory, 'e.g. Electronics')}
                                {renderFormField('Subcategory', subcategory, setSubcategory, 'e.g. Smart Lighting')}
                                {renderFormField('Tags', tags, setTags, 'tag1, tag2, tag3')}

                                {/* Options & Specs */}
                                <Text style={styles.sectionLabel}>Options & Specs</Text>
                                {renderFormField(
                                    'Options',
                                    optionsRaw,
                                    setOptionsRaw,
                                    'Size: S, M, L | Color: Red, Blue',
                                    true
                                )}
                                {renderFormField(
                                    'Specifications',
                                    specsRaw,
                                    setSpecsRaw,
                                    'Weight: 1.2kg, Material: Glass',
                                    true
                                )}

                                {/* Shipping */}
                                <Text style={styles.sectionLabel}>Shipping</Text>
                                {renderFormField('Delivery', delivery, setDelivery, 'Ships in 2-3 business days')}
                                {renderFormField('Return Policy', returnPolicy, setReturnPolicy, '30 days easy return')}
                            </>
                        )}

                        {nodeType === 'Collections' && (
                            <>
                                <Text style={styles.sectionLabel}>Collection Details</Text>
                                {renderFormField('Description', collectionDescription, setCollectionDescription, 'Describe this collection...', true)}
                                {renderFormField('Tags', collectionTags, setCollectionTags, 'tag1, tag2, tag3')}
                            </>
                        )}

                        {nodeType === 'Options' && (
                            <>
                                <Text style={styles.sectionLabel}>Option Details</Text>
                                {renderFormField('Option Values', optionValues, setOptionValues, 'e.g. Small, Medium, Large', true)}
                            </>
                        )}

                        {nodeType === 'Group' && (
                            <>
                                <Text style={styles.sectionLabel}>Group Details</Text>
                                {renderFormField('Description', groupDescription, setGroupDescription, 'Describe this group...', true)}
                                {renderFormField('Members / Items', groupMembers, setGroupMembers, 'List items in this group...', true)}
                            </>
                        )}
                    </View>
                )}

                {/* Save */}
                <TouchableOpacity
                    style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveBtnText}>Save Node</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 60,
    },

    // --- Fields ---
    field: {
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9CA3AF',
        letterSpacing: 0.3,
        marginBottom: 6,
    },
    fieldInput: {
        backgroundColor: '#F9FAFB',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 11,
        fontSize: 15,
        color: '#111827',
    },
    fieldMultiline: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    fieldRow: {
        flexDirection: 'row',
        gap: 12,
    },

    // --- Type selector ---
    typeContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    typeBtn: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    typeBtnActive: {
        backgroundColor: '#0139E6',
    },
    typeBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    typeBtnTextActive: {
        color: '#FFF',
    },

    // --- Mode toggle ---
    modeToggle: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        padding: 3,
        marginBottom: 20,
    },
    modeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
    },
    modeBtnActive: {
        backgroundColor: '#0139E6',
    },
    modeBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    modeBtnTextActive: {
        color: '#FFF',
    },

    // --- Section labels ---
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#D1D5DB',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginTop: 12,
        marginBottom: 14,
    },
    formSections: {},

    // --- AI section ---
    aiSection: {
        marginBottom: 20,
    },
    aiHint: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
        marginBottom: 12,
    },
    aiInput: {
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 12,
    },
    aiBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#0139E6',
        paddingVertical: 14,
        borderRadius: 10,
    },
    aiBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },
    aiWarning: {
        fontSize: 13,
        color: '#F59E0B',
        marginTop: 10,
        textAlign: 'center',
    },

    // --- Save ---
    saveBtn: {
        backgroundColor: '#0139E6',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 24,
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
