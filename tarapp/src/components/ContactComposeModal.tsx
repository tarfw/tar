import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const CONTACT_SUBTYPES = [
  { label: 'Customer', value: 'Customer', subtitle: 'External Buyer or Client' },
  { label: 'Staff', value: 'Staff', subtitle: 'Internal Team Member' },
  { label: 'Contact', value: 'Contact', subtitle: 'General Relationship / Individual' },
  { label: 'Vendor', value: 'Vendor', subtitle: 'Supplier Organization' },
  { label: 'Partner', value: 'Partner', subtitle: 'Collaborative Org / Partner' },
];

export interface ContactComposeModalProps {
  visible: boolean;
  theme: any;
  submitting: boolean;
  resultMessage: string | null;
  initialType?: string;
  onClose: () => void;
  onSave: (contactData: {
    name: string;
    role: string;
    email: string;
    phone: string;
    org: string;
    notes?: string;
  }) => void;
}

export default function ContactComposeModal({
  visible,
  theme,
  submitting,
  resultMessage,
  initialType = 'Customer',
  onClose,
  onSave,
}: ContactComposeModalProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [role, setRole] = useState(initialType);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [org, setOrg] = useState('');
  const [notes, setNotes] = useState('');
  const [showRolePicker, setShowRolePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setRole(initialType || 'Customer');
      setEmail('');
      setPhone('');
      setOrg('');
      setNotes('');
    }
  }, [visible, initialType]);

  if (!visible) return null;

  const isFormValid = name.trim().length > 0;
  const isCompanyType = role === 'Vendor' || role === 'Partner';

  const handleSave = () => {
    if (!isFormValid || submitting) return;
    onSave({
      name: name.trim(),
      role,
      email: email.trim(),
      phone: phone.trim(),
      org: org.trim(),
      notes: notes.trim(),
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 12) }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Top Bar */}
          <View style={[styles.headerBar, { borderBottomColor: theme.border }]}>
            {/* Left Role/Type Selector Pill */}
            <Pressable
              onPress={() => setShowRolePicker(true)}
              style={({ pressed }) => [
                styles.headerPill,
                { backgroundColor: theme.primary + '15', opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.headerPillText, { color: theme.primary }]}>
                {role}
              </Text>
              <Ionicons name="chevron-down" size={14} color={theme.primary} />
            </Pressable>

            {/* Right Save Action */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={submitting || !isFormValid}
              hitSlop={8}
              style={[styles.saveBtn, { opacity: isFormValid && !submitting ? 1 : 0.4 }]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[styles.saveText, { color: theme.primary }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Toast Banner */}
          {resultMessage && (
            <View
              style={[
                styles.resultToast,
                { backgroundColor: resultMessage.includes('Error') || resultMessage.includes('Failed') ? '#fef2f2' : '#f0fdf4' },
              ]}
            >
              <Ionicons
                name={resultMessage.includes('Error') || resultMessage.includes('Failed') ? 'alert-circle' : 'checkmark-circle'}
                size={18}
                color={resultMessage.includes('Error') || resultMessage.includes('Failed') ? '#dc2626' : '#16a34a'}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: resultMessage.includes('Error') || resultMessage.includes('Failed') ? '#dc2626' : '#16a34a',
                  flex: 1,
                }}
              >
                {resultMessage}
              </Text>
            </View>
          )}

          {/* Form Scroll Area */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollBody, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Row 1: Name / Title Input */}
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <TextInput
                style={[styles.fieldInput, { color: theme.text, fontWeight: '500' }]}
                value={name}
                onChangeText={setName}
                placeholder={isCompanyType ? 'Company Name *' : 'Full Name *'}
                placeholderTextColor={theme.textMuted + '80'}
              />
            </View>

            {/* Row 2: Email */}
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                value={email}
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={theme.textMuted + '80'}
              />
            </View>

            {/* Row 3: Phone */}
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                value={phone}
                keyboardType="phone-pad"
                onChangeText={setPhone}
                placeholder="Phone number"
                placeholderTextColor={theme.textMuted + '80'}
              />
            </View>

            {/* Row 4: Company / Address */}
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                value={org}
                onChangeText={setOrg}
                placeholder={isCompanyType ? 'Address / Website' : 'Company / Organization'}
                placeholderTextColor={theme.textMuted + '80'}
              />
            </View>

            {/* Row 5: Notes & Description */}
            <View style={styles.bodyContainer}>
              <TextInput
                style={[styles.bodyInput, { color: theme.text }]}
                multiline
                value={notes}
                onChangeText={setNotes}
                placeholder="Compose contact notes, bio, or description..."
                placeholderTextColor={theme.textMuted + '80'}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* Contact Role Picker Modal */}
      <Modal
        visible={showRolePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRolePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowRolePicker(false)}>
          <Pressable style={[styles.pickerContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Role / Type</Text>
              <Pressable onPress={() => setShowRolePicker(false)}>
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              {CONTACT_SUBTYPES.map((typeObj) => {
                const isSelected = role === typeObj.value;
                return (
                  <Pressable
                    key={typeObj.value}
                    onPress={() => {
                      setRole(typeObj.value);
                      setShowRolePicker(false);
                    }}
                    style={({ pressed }) => [
                      styles.pickerItem,
                      {
                        borderBottomColor: theme.border + '40',
                        backgroundColor: pressed ? theme.border + '30' : isSelected ? theme.primary + '15' : 'transparent',
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: isSelected ? '700' : '500', color: isSelected ? theme.primary : theme.text }}>
                        {typeObj.label}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                        {typeObj.subtitle}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark" size={18} color={theme.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerPillText: {
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  saveBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  saveText: {
    fontSize: 17,
    fontWeight: '600',
  },
  resultToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  fieldRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  bodyContainer: {
    paddingTop: 16,
    minHeight: 200,
  },
  bodyInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 180,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
