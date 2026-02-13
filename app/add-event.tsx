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

/**
 * ADD EVENT SCREEN
 * Path: app/add-event.tsx
 */

export default function AddEventScreen() {
    const router = useRouter();
    const [scope, setScope] = useState('');
    const [status, setStatus] = useState('pending');
    const [opcode, setOpcode] = useState('1');
    const [payload, setPayload] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!scope.trim()) {
            alert('Please fill in Scope');
            return;
        }

        setIsSaving(true);
        try {
            const newEvent = {
                id: Math.random().toString(36).substring(7),
                streamid: 'local-test-stream', // Placeholder for now
                opcode: parseInt(opcode) || 1,
                refid: 'ref-' + Math.random().toString(36).substring(7),
                scope: scope.trim(),
                status: status,
                payload: payload.trim() || undefined,
            };

            await dbHelpers.insertEvent(newEvent);
            router.back();
        } catch (error) {
            console.error('Failed to save event:', error);
            alert('Error saving event. Check console.');
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
                <Text style={styles.headerTitle}>Create Timeline Event</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Event Scope / Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. USER_LOGIN or STOCK_UPDATE"
                        value={scope}
                        onChangeText={setScope}
                        autoCapitalize="characters"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Status</Text>
                    <View style={styles.typeContainer}>
                        {['pending', 'success', 'failed'].map((s) => (
                            <TouchableOpacity
                                key={s}
                                style={[
                                    styles.typeButton,
                                    status === s && styles.typeButtonActive
                                ]}
                                onPress={() => setStatus(s)}
                            >
                                <Text style={[
                                    styles.typeButtonText,
                                    status === s && styles.typeButtonTextActive
                                ]}>
                                    {s}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>OpCode (1-99)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. 1"
                        value={opcode}
                        onChangeText={(val) => setOpcode(val.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Payload (JSON String)</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder='e.g. {"user_id": 123}'
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
                        <Text style={styles.saveButtonText}>Generate Event</Text>
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
        paddingVertical: 15,
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
        backgroundColor: '#22C55E',
        borderColor: '#22C55E',
    },
    typeButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666',
        textTransform: 'capitalize',
    },
    typeButtonTextActive: {
        color: '#fff',
    },
    saveButton: {
        backgroundColor: '#22C55E',
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
