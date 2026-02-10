import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
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

export default function AddNodeScreen() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [nodeType, setNodeType] = useState('Product');
    const [universalCode, setUniversalCode] = useState('');
    const [payload, setPayload] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!title.trim() || !universalCode.trim()) {
            alert('Please fill in Title and Universal Code');
            return;
        }

        setIsSaving(true);
        try {
            const newNode = {
                id: Math.random().toString(36).substring(7),
                title: title.trim(),
                nodetype: nodeType,
                universalcode: universalCode.trim(),
                payload: payload.trim() || undefined,
            };

            await dbHelpers.insertNode(newNode);
            alert('Node saved successfully!');
            router.back();
        } catch (error) {
            console.error('Failed to save node:', error);
            alert('Error saving node. Check console.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add New Node</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Title</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Smart LED Bulb"
                        value={title}
                        onChangeText={setTitle}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Node Type</Text>
                    <View style={styles.typeContainer}>
                        {['Product', 'Category', 'Collection'].map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    styles.typeButton,
                                    nodeType === type && styles.typeButtonActive
                                ]}
                                onPress={() => setNodeType(type)}
                            >
                                <Text style={[
                                    styles.typeButtonText,
                                    nodeType === type && styles.typeButtonTextActive
                                ]}>
                                    {type}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Universal Code</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. PROD-12345"
                        value={universalCode}
                        onChangeText={setUniversalCode}
                        autoCapitalize="characters"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Payload (Description/JSON)</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Additional details about this node..."
                        value={payload}
                        onChangeText={setPayload}
                        multiline
                        numberOfLines={4}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Node</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000',
    },
    scrollContent: {
        padding: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: '#E9ECEF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#000',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    typeContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#F8F9FA',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E9ECEF',
    },
    typeButtonActive: {
        backgroundColor: '#006AFF',
        borderColor: '#006AFF',
    },
    typeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    typeButtonTextActive: {
        color: '#fff',
    },
    saveButton: {
        backgroundColor: '#006AFF',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 20,
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
