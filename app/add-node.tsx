import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
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
    ProductPayload,
    refineProductPayload
} from '../lib/groq-service';

export default function AddNodeScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const initialType = typeof params.type === 'string' ? params.type : 'Products';
    const isTypeFixed = typeof params.type === 'string';

    // ─── State ───
    const [nodeType, setNodeType] = useState(initialType);
    const [isSaving, setIsSaving] = useState(false);

    // AI state
    const [aiPrompt, setAiPrompt] = useState('');
    const [refinementPrompt, setRefinementPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    const [hasApiKey, setHasApiKey] = useState(false);
    const [generatedPayload, setGeneratedPayload] = useState<ProductPayload | null>(null);

    // Editable fields
    const [editedTitle, setEditedTitle] = useState('');
    const [editedCode, setEditedCode] = useState('');
    const [showFullForm, setShowFullForm] = useState(false);

    // Form fields
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
    const [collectionDescription, setCollectionDescription] = useState('');
    const [collectionTags, setCollectionTags] = useState('');
    const [postContent, setPostContent] = useState('');
    const [postTags, setPostTags] = useState('');

    // Inline editing
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState('');

    // Animations
    const previewFadeAnim = useRef(new Animated.Value(0)).current;
    const dotAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        getGroqApiKey().then((k) => setHasApiKey(!!k));
    }, []);

    // Dot pulse while generating
    useEffect(() => {
        if (isGenerating || isRefining) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                    Animated.timing(dotAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
                ])
            ).start();
        } else {
            dotAnim.setValue(0);
        }
    }, [isGenerating, isRefining]);

    useEffect(() => {
        if (generatedPayload) {
            Animated.spring(previewFadeAnim, {
                toValue: 1, friction: 8, tension: 40, useNativeDriver: true,
            }).start();
        }
    }, [generatedPayload]);

    useEffect(() => {
        if (nodeType !== 'Products' && !generatedPayload) {
            setShowFullForm(true);
        }
    }, [nodeType, generatedPayload]);

    // ─── Populate from payload ───
    const populateFormFromPayload = (p: ProductPayload) => {
        if (p.title) setEditedTitle(p.title);
        if (p.universal_code) setEditedCode(p.universal_code);
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
    };

    // ─── AI Generate ───
    const handleAiGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setIsGenerating(true);
        previewFadeAnim.setValue(0);
        try {
            const payload = await generateProductPayload(aiPrompt.trim());
            setGeneratedPayload(payload);
            populateFormFromPayload(payload);
        } catch (e: any) {
            Alert.alert('AI Error', e.message || 'Failed to generate product data.');
        } finally {
            setIsGenerating(false);
        }
    };

    // ─── AI Refine ───
    const handleAiRefine = async () => {
        if (!refinementPrompt.trim() || !generatedPayload) return;
        setIsRefining(true);
        try {
            const refined = await refineProductPayload(generatedPayload, refinementPrompt.trim());
            setGeneratedPayload(refined);
            populateFormFromPayload(refined);
            setRefinementPrompt('');
        } catch (e: any) {
            Alert.alert('AI Error', e.message || 'Failed to refine product data.');
        } finally {
            setIsRefining(false);
        }
    };

    // ─── Inline Edit ───
    const startInlineEdit = (field: string, currentValue: string) => {
        setEditingField(field);
        setEditingValue(currentValue);
    };

    const saveInlineEdit = () => {
        if (!editingField || !generatedPayload) return;
        const updated = { ...generatedPayload };
        switch (editingField) {
            case 'title': updated.title = editingValue; setEditedTitle(editingValue); break;
            case 'universal_code': updated.universal_code = editingValue; setEditedCode(editingValue); break;
            case 'description': updated.description = editingValue; setDescription(editingValue); break;
            case 'brand': updated.brand = editingValue; setBrand(editingValue); break;
            case 'availability': updated.availability = editingValue; setAvailability(editingValue); break;
            case 'delivery': updated.delivery = editingValue; setDelivery(editingValue); break;
            case 'return_policy': updated.return_policy = editingValue; setReturnPolicy(editingValue); break;
            case 'price':
                const amt = parseFloat(editingValue);
                if (!isNaN(amt)) { updated.price = { ...updated.price, amount: amt }; setPriceAmount(editingValue); }
                break;
            case 'category':
                updated.categorization = { ...updated.categorization, category: editingValue };
                setCategory(editingValue);
                break;
        }
        setGeneratedPayload(updated);
        setEditingField(null);
        setEditingValue('');
    };

    // ─── Build Payload & Save ───
    const buildPayload = (): string => {
        const payload: any = {};
        if (description.trim()) payload.description = description.trim();
        if (brand.trim()) payload.brand = brand.trim();
        if (gtin.trim()) payload.gtin = gtin.trim();
        if (mpn.trim()) payload.mpn = mpn.trim();
        if (availability) payload.availability = availability;
        if (priceAmount.trim()) {
            payload.price = { amount: parseFloat(priceAmount), currency: priceCurrency || 'USD' };
            if (priceRange.trim()) payload.price.range = priceRange.trim();
        }
        if (category.trim()) {
            payload.categorization = { category: category.trim() };
            if (subcategory.trim()) payload.categorization.subcategory = subcategory.trim();
            if (tags.trim()) payload.categorization.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
        }
        if (optionsRaw.trim()) {
            payload.options = optionsRaw.split('|').map(group => {
                const [name, ...vals] = group.split(':');
                return { name: name?.trim() || '', values: vals.join(':').split(',').map(v => v.trim()).filter(Boolean) };
            }).filter(o => o.name);
        }
        if (specsRaw.trim()) {
            payload.specifications = {};
            specsRaw.split(',').forEach(pair => {
                const [k, ...v] = pair.split(':');
                if (k?.trim() && v.length) payload.specifications[k.trim()] = v.join(':').trim();
            });
        }
        if (delivery.trim()) payload.delivery = delivery.trim();
        if (returnPolicy.trim()) payload.return_policy = returnPolicy.trim();

        // Collection-specific
        if (nodeType === 'Collections') {
            if (collectionDescription.trim()) payload.description = collectionDescription.trim();
            if (collectionTags.trim()) payload.tags = collectionTags.split(',').map(t => t.trim()).filter(Boolean);
        }

        // Post-specific
        if (nodeType === 'Posts') {
            if (postContent.trim()) payload.content = postContent.trim();
            if (postTags.trim()) payload.tags = postTags.split(',').map(t => t.trim()).filter(Boolean);
        }

        return JSON.stringify(payload);
    };

    const handleSave = async () => {
        const finalTitle = editedTitle.trim();
        const finalCode = editedCode.trim();
        if (!finalTitle || !finalCode) {
            Alert.alert('Missing Fields', 'Please ensure Title and Universal Code are set.');
            return;
        }
        setIsSaving(true);
        try {
            await dbHelpers.insertNode({
                id: Math.random().toString(36).substring(7),
                title: finalTitle,
                nodetype: nodeType,
                universalcode: finalCode,
                payload: buildPayload() !== '{}' ? buildPayload() : undefined,
            });
            router.back();
        } catch (error) {
            console.error('Failed to save node:', error);
            Alert.alert('Error', 'Error saving node. Check console.');
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Render ───
    const singularType = nodeType.endsWith('s') ? nodeType.slice(0, -1) : nodeType;

    const renderProperty = (icon: string, label: string, value: string, field: string) => (
        <TouchableOpacity
            key={field}
            style={s.property}
            onPress={() => startInlineEdit(field, value)}
            activeOpacity={0.6}
        >
            <Text style={s.propertyIcon}>{icon}</Text>
            <Text style={s.propertyLabel}>{label}</Text>
            <Text style={s.propertyValue} numberOfLines={1}>{value || 'Empty'}</Text>
        </TouchableOpacity>
    );

    const renderFormField = (
        label: string, value: string, setter: (v: string) => void, placeholder: string, multiline = false
    ) => (
        <View style={s.formField}>
            <Text style={s.formFieldLabel}>{label}</Text>
            <TextInput
                style={[s.formFieldInput, multiline && s.formFieldMultiline]}
                placeholder={placeholder}
                placeholderTextColor="#CBD5E1"
                value={value}
                onChangeText={setter}
                multiline={multiline}
            />
        </View>
    );

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={s.container}
        >
            {/* ─── Minimal Top Bar ─── */}
            <View style={s.topBar}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
                </TouchableOpacity>

                {/* Node type pills (right side) */}
                {!isTypeFixed && (
                    <View style={s.typePills}>
                        {['Products', 'Collections', 'Posts'].map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[s.pill, nodeType === type && s.pillActive]}
                                onPress={() => setNodeType(type)}
                            >
                                <Text style={[s.pillText, nodeType === type && s.pillTextActive]}>
                                    {type}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Save button — always visible for non-Products, or when generatedPayload exists for Products */}
                {(generatedPayload || nodeType !== 'Products') && (
                    <TouchableOpacity
                        style={[s.saveTopBtn, isSaving && { opacity: 0.5 }]}
                        onPress={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                            <Text style={s.saveTopBtnText}>Save</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                contentContainerStyle={s.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* ─── NOTION-STYLE TITLE ─── */}
                <TextInput
                    style={s.notionTitle}
                    placeholder="Untitled"
                    placeholderTextColor="#D1D5DB"
                    value={editedTitle}
                    onChangeText={setEditedTitle}
                    multiline
                />

                {/* ─── Universal Code (inline) ─── */}
                <View style={s.codeInline}>
                    <MaterialCommunityIcons name="barcode-scan" size={14} color="#7C3AED" />
                    <TextInput
                        style={s.codeInlineInput}
                        placeholder="Set code (e.g. PST-001)"
                        placeholderTextColor="#C4B5FD"
                        value={editedCode}
                        onChangeText={setEditedCode}
                    />
                </View>

                {/* ─── Divider ─── */}
                <View style={s.divider} />

                {/* ─── POSTS / COLLECTIONS: Direct Form ─── */}
                {nodeType === 'Posts' && (
                    <View style={s.directForm}>
                        <TextInput
                            style={s.postContentInput}
                            placeholder="Write your post content here..."
                            placeholderTextColor="#CBD5E1"
                            value={postContent}
                            onChangeText={setPostContent}
                            multiline
                            textAlignVertical="top"
                        />
                        <View style={s.directFormField}>
                            <MaterialCommunityIcons name="tag-multiple-outline" size={16} color="#9CA3AF" style={{ marginRight: 8, marginTop: 2 }} />
                            <TextInput
                                style={s.directFormInput}
                                placeholder="Add tags (comma separated)"
                                placeholderTextColor="#CBD5E1"
                                value={postTags}
                                onChangeText={setPostTags}
                            />
                        </View>
                    </View>
                )}

                {nodeType === 'Collections' && (
                    <View style={s.directForm}>
                        <TextInput
                            style={s.postContentInput}
                            placeholder="Describe this collection..."
                            placeholderTextColor="#CBD5E1"
                            value={collectionDescription}
                            onChangeText={setCollectionDescription}
                            multiline
                            textAlignVertical="top"
                        />
                        <View style={s.directFormField}>
                            <MaterialCommunityIcons name="tag-multiple-outline" size={16} color="#9CA3AF" style={{ marginRight: 8, marginTop: 2 }} />
                            <TextInput
                                style={s.directFormInput}
                                placeholder="Add tags (comma separated)"
                                placeholderTextColor="#CBD5E1"
                                value={collectionTags}
                                onChangeText={setCollectionTags}
                            />
                        </View>
                    </View>
                )}

                {/* ─── PRODUCTS: AI Input (before generation) ─── */}
                {!generatedPayload && nodeType === 'Products' && (
                    <View style={s.aiSection}>
                        <TextInput
                            style={s.aiInput}
                            placeholder={`Describe your ${singularType.toLowerCase()} and let AI fill in the details...`}
                            placeholderTextColor="#CBD5E1"
                            value={aiPrompt}
                            onChangeText={setAiPrompt}
                            multiline
                            textAlignVertical="top"
                        />

                        {aiPrompt.trim().length > 0 && (
                            <TouchableOpacity
                                style={[s.aiBtn, isGenerating && { opacity: 0.6 }]}
                                onPress={handleAiGenerate}
                                disabled={isGenerating}
                                activeOpacity={0.7}
                            >
                                {isGenerating ? (
                                    <Animated.View style={[s.aiBtnInner, { opacity: dotAnim }]}>
                                        <ActivityIndicator color="#7C3AED" size="small" />
                                        <Text style={s.aiBtnText}>Generating...</Text>
                                    </Animated.View>
                                ) : (
                                    <View style={s.aiBtnInner}>
                                        <MaterialCommunityIcons name="creation" size={16} color="#7C3AED" />
                                        <Text style={s.aiBtnText}>Generate with AI</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        )}

                        {!hasApiKey && (
                            <Text style={s.apiWarning}>No API key configured — go to Settings</Text>
                        )}

                        <TouchableOpacity
                            style={s.manualToggle}
                            onPress={() => {
                                setGeneratedPayload({} as ProductPayload);
                                setShowFullForm(true);
                            }}
                        >
                            <Text style={s.manualToggleText}>or enter manually</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ─── Generated Data (Notion property list) — Products only ─── */}
                {generatedPayload && nodeType === 'Products' && (
                    <Animated.View style={[s.propertiesSection, {
                        opacity: previewFadeAnim,
                        transform: [{ translateY: previewFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }]
                    }]}>

                        {/* Properties table */}
                        <View style={s.propertiesTable}>
                            {generatedPayload.brand && renderProperty('🏷️', 'Brand', generatedPayload.brand, 'brand')}
                            {generatedPayload.price?.amount != null && renderProperty(
                                '💰', 'Price',
                                `${generatedPayload.price.currency || 'USD'} ${generatedPayload.price.amount}`,
                                'price'
                            )}
                            {generatedPayload.availability && renderProperty('📦', 'Status', generatedPayload.availability, 'availability')}
                            {generatedPayload.categorization?.category && renderProperty(
                                '📂', 'Category',
                                `${generatedPayload.categorization.category}${generatedPayload.categorization.subcategory ? ' › ' + generatedPayload.categorization.subcategory : ''}`,
                                'category'
                            )}
                            {generatedPayload.delivery && renderProperty('🚚', 'Delivery', generatedPayload.delivery, 'delivery')}
                            {generatedPayload.return_policy && renderProperty('↩️', 'Returns', generatedPayload.return_policy, 'return_policy')}
                        </View>

                        {/* Tags */}
                        {generatedPayload.categorization?.tags && generatedPayload.categorization.tags.length > 0 && (
                            <View style={s.tagsSection}>
                                <Text style={s.tagsSectionLabel}>Tags</Text>
                                <View style={s.tagsRow}>
                                    {generatedPayload.categorization.tags.map((tag, i) => (
                                        <View key={i} style={s.tag}>
                                            <Text style={s.tagText}>{tag}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Description block */}
                        {generatedPayload.description && (
                            <TouchableOpacity
                                style={s.descBlock}
                                onPress={() => startInlineEdit('description', generatedPayload.description || '')}
                                activeOpacity={0.6}
                            >
                                <Text style={s.descText}>{generatedPayload.description}</Text>
                            </TouchableOpacity>
                        )}

                        {/* Options */}
                        {generatedPayload.options && generatedPayload.options.length > 0 && (
                            <View style={s.tableBlock}>
                                <Text style={s.tableBlockTitle}>Options</Text>
                                {generatedPayload.options.map((opt, i) => (
                                    <View key={i} style={s.tableRow}>
                                        <Text style={s.tableRowKey}>{opt.name}</Text>
                                        <Text style={s.tableRowValue}>{opt.values.join(', ')}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Specifications */}
                        {generatedPayload.specifications && Object.keys(generatedPayload.specifications).length > 0 && (
                            <View style={s.tableBlock}>
                                <Text style={s.tableBlockTitle}>Specifications</Text>
                                {Object.entries(generatedPayload.specifications).map(([k, v], i) => (
                                    <View key={i} style={s.tableRow}>
                                        <Text style={s.tableRowKey}>{k}</Text>
                                        <Text style={s.tableRowValue}>{v}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* ── Refine bar ── */}
                        <View style={s.refineBar}>
                            <MaterialCommunityIcons name="creation" size={16} color="#A78BFA" style={{ marginRight: 8 }} />
                            <TextInput
                                style={s.refineInput}
                                placeholder="Ask AI to change something..."
                                placeholderTextColor="#CBD5E1"
                                value={refinementPrompt}
                                onChangeText={setRefinementPrompt}
                                onSubmitEditing={handleAiRefine}
                                returnKeyType="send"
                            />
                            {refinementPrompt.trim().length > 0 && (
                                <TouchableOpacity
                                    style={[s.refineSend, isRefining && { opacity: 0.4 }]}
                                    onPress={handleAiRefine}
                                    disabled={isRefining}
                                >
                                    {isRefining ? (
                                        <ActivityIndicator color="#7C3AED" size="small" />
                                    ) : (
                                        <MaterialCommunityIcons name="arrow-up-circle" size={28} color="#7C3AED" />
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* ── Toggle full form ── */}
                        <TouchableOpacity
                            style={s.editAllToggle}
                            onPress={() => setShowFullForm(!showFullForm)}
                        >
                            <MaterialCommunityIcons
                                name={showFullForm ? "chevron-up" : "dots-horizontal"}
                                size={16}
                                color="#9CA3AF"
                            />
                            <Text style={s.editAllText}>
                                {showFullForm ? 'Collapse' : 'All fields'}
                            </Text>
                        </TouchableOpacity>

                        {showFullForm && (
                            <View style={s.fullForm}>
                                {renderFormField('Title', editedTitle, setEditedTitle, 'Product title')}
                                {renderFormField('Universal Code', editedCode, setEditedCode, 'PRD-XXX-001')}
                                {renderFormField('Brand', brand, setBrand, 'e.g. Nike')}
                                {renderFormField('Description', description, setDescription, 'Product description...', true)}
                                <View style={s.fieldRow}>
                                    <View style={{ flex: 2 }}>{renderFormField('Price', priceAmount, setPriceAmount, '49.99')}</View>
                                    <View style={{ flex: 1 }}>{renderFormField('Currency', priceCurrency, setPriceCurrency, 'USD')}</View>
                                </View>
                                {renderFormField('Range', priceRange, setPriceRange, 'e.g. $40 - $60')}
                                {renderFormField('GTIN', gtin, setGtin, 'EAN / UPC barcode')}
                                {renderFormField('MPN', mpn, setMpn, 'Manufacturer Part Number')}
                                {renderFormField('Category', category, setCategory, 'e.g. Electronics')}
                                {renderFormField('Subcategory', subcategory, setSubcategory, 'e.g. Smart Lighting')}
                                {renderFormField('Tags', tags, setTags, 'tag1, tag2, tag3')}
                                {renderFormField('Options', optionsRaw, setOptionsRaw, 'Size: S, M, L | Color: Red, Blue', true)}
                                {renderFormField('Specifications', specsRaw, setSpecsRaw, 'Weight: 1.2kg, Material: Glass', true)}
                                {renderFormField('Delivery', delivery, setDelivery, 'Ships in 2-3 business days')}
                                {renderFormField('Return Policy', returnPolicy, setReturnPolicy, '30 days easy return')}
                            </View>
                        )}
                    </Animated.View>
                )}

                {/* ─── Inline Edit Overlay ─── */}
                {editingField && (
                    <View style={s.inlineOverlay}>
                        <View style={s.inlineCard}>
                            <Text style={s.inlineLabel}>{editingField.replace(/_/g, ' ')}</Text>
                            <TextInput
                                style={s.inlineInput}
                                value={editingValue}
                                onChangeText={setEditingValue}
                                autoFocus
                                multiline={editingField === 'description'}
                                placeholderTextColor="#CBD5E1"
                            />
                            <View style={s.inlineActions}>
                                <TouchableOpacity onPress={() => { setEditingField(null); setEditingValue(''); }}>
                                    <Text style={s.inlineCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={s.inlineSaveBtn} onPress={saveInlineEdit}>
                                    <Text style={s.inlineSaveBtnText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ─── Styles ───
const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },

    // ── Top Bar ──
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 12,
    },
    typePills: {
        flexDirection: 'row',
        flex: 1,
        gap: 4,
        marginLeft: 8,
    },
    pill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    pillActive: {
        backgroundColor: '#F3F4F6',
    },
    pillText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#9CA3AF',
    },
    pillTextActive: {
        color: '#111827',
        fontWeight: '600',
    },
    saveTopBtn: {
        backgroundColor: '#111827',
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderRadius: 6,
    },
    saveTopBtnText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },

    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 100,
    },

    // ── Notion Title ──
    notionTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: '#111827',
        letterSpacing: -0.5,
        paddingVertical: 8,
        marginTop: 8,
        lineHeight: 40,
    },

    // ── Code inline ──
    codeInline: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        marginBottom: 4,
    },
    codeInlineText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#7C3AED',
        letterSpacing: 0.5,
    },
    codeInlineInput: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: '#7C3AED',
        letterSpacing: 0.5,
        paddingVertical: 0,
    },

    // ── Direct Form (Posts / Collections) ──
    directForm: {
        gap: 16,
    },
    postContentInput: {
        fontSize: 16,
        color: '#374151',
        lineHeight: 24,
        minHeight: 200,
        paddingVertical: 0,
    },
    directFormField: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        paddingTop: 12,
    },
    directFormInput: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
        paddingVertical: 0,
    },

    // ── Divider ──
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 16,
    },

    // ── AI Section ──
    aiSection: {
        gap: 12,
    },
    aiInput: {
        fontSize: 16,
        color: '#374151',
        lineHeight: 24,
        minHeight: 80,
        paddingVertical: 0,
    },
    aiBtn: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#E9E5F5',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#FAFAFF',
    },
    aiBtnInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    aiBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#7C3AED',
    },
    apiWarning: {
        fontSize: 12,
        color: '#F59E0B',
    },
    manualToggle: {
        paddingVertical: 4,
    },
    manualToggleText: {
        fontSize: 13,
        color: '#9CA3AF',
        fontWeight: '500',
    },

    // ── Properties (Notion style) ──
    propertiesSection: {
        gap: 0,
    },
    propertiesTable: {
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    property: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 8,
    },
    propertyIcon: {
        fontSize: 14,
        width: 22,
    },
    propertyLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#9CA3AF',
        width: 80,
    },
    propertyValue: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },

    // ── Tags ──
    tagsSection: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 8,
    },
    tagsSectionLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#9CA3AF',
        width: 80,
        marginLeft: 30,
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        flex: 1,
    },
    tag: {
        backgroundColor: '#F3F0FF',
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    tagText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#7C3AED',
    },

    // ── Description Block ──
    descBlock: {
        paddingVertical: 16,
    },
    descText: {
        fontSize: 15,
        color: '#4B5563',
        lineHeight: 23,
    },

    // ── Table Block (Options, Specs) ──
    tableBlock: {
        marginBottom: 8,
    },
    tableBlockTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginTop: 8,
    },
    tableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 7,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#F3F4F6',
    },
    tableRowKey: {
        fontSize: 13,
        fontWeight: '500',
        color: '#9CA3AF',
    },
    tableRowValue: {
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
        textAlign: 'right',
        flex: 1,
        marginLeft: 16,
    },

    // ── Refine Bar ──
    refineBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F3F4F6',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginTop: 20,
        backgroundColor: '#FAFAFA',
    },
    refineInput: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
        paddingVertical: 4,
    },
    refineSend: {
        marginLeft: 4,
    },

    // ── Edit All ──
    editAllToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 12,
        marginTop: 4,
    },
    editAllText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#9CA3AF',
    },

    // ── Full Form ──
    fullForm: {
        gap: 0,
    },
    formField: {
        marginBottom: 16,
    },
    formFieldLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#9CA3AF',
        marginBottom: 4,
    },
    formFieldInput: {
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingVertical: 8,
        fontSize: 15,
        color: '#111827',
    },
    formFieldMultiline: {
        minHeight: 60,
        textAlignVertical: 'top',
        borderBottomWidth: 0,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    fieldRow: {
        flexDirection: 'row',
        gap: 16,
    },

    // ── Inline Edit ──
    inlineOverlay: {
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: 12,
        padding: 4,
        marginVertical: 8,
    },
    inlineCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    inlineLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9CA3AF',
        textTransform: 'capitalize',
        marginBottom: 10,
    },
    inlineInput: {
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingVertical: 8,
        fontSize: 15,
        color: '#111827',
        marginBottom: 16,
    },
    inlineActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 16,
    },
    inlineCancelText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#9CA3AF',
    },
    inlineSaveBtn: {
        backgroundColor: '#111827',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    inlineSaveBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
