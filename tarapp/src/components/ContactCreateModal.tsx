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
  { label: 'Customer', value: 'Customer', subtitle: 'External Buyer, Client or Individual' },
  { label: 'Company', value: 'Company', subtitle: 'Business Account / Organization' },
  { label: 'Staff', value: 'Staff', subtitle: 'Internal Team Member' },
  { label: 'Vendor', value: 'Vendor', subtitle: 'Supplier Organization' },
  { label: 'Partner', value: 'Partner', subtitle: 'Collaborative Partner' },
];

export interface ContactCreateModalProps {
  visible: boolean;
  theme: any;
  submitting: boolean;
  resultMessage: string | null;
  initialType?: string;
  allEntities?: any[];
  editEntity?: any | null;
  onClose: () => void;
  onSave: (contactData: {
    name: string;
    role: string;
    email: string;
    phone: string;
    org: string;
    notes?: string;
  }) => void;
  onUpdate?: (contactData: {
    name: string;
    role: string;
    email: string;
    phone: string;
    org: string;
    notes?: string;
  }) => void;
}

export default function ContactCreateModal({
  visible,
  theme,
  submitting,
  resultMessage,
  initialType = 'Customer',
  allEntities = [],
  editEntity = null,
  onClose,
  onSave,
  onUpdate,
}: ContactCreateModalProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [role, setRole] = useState(initialType);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [org, setOrg] = useState('');
  const [notes, setNotes] = useState('');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);

  const isEditMode = !!editEntity;

  useEffect(() => {
    if (visible) {
      if (editEntity) {
        setName(editEntity.name || editEntity.title || '');
        const entityType = (editEntity.type || editEntity.subRole || initialType || 'Customer');
        setRole(entityType.charAt(0).toUpperCase() + entityType.slice(1));
        setEmail(editEntity.data?.email || '');
        setPhone(editEntity.data?.phone || '');
        setOrg(editEntity.company || editEntity.data?.company || editEntity.data?.org || '');
        setNotes(editEntity.notes || editEntity.data?.notes || editEntity.data?.description || '');
      } else {
        setName('');
        setRole(initialType || 'Customer');
        setEmail('');
        setPhone('');
        setOrg('');
        setNotes('');
      }
    }
  }, [visible, initialType, editEntity]);

  if (!visible) return null;

  const isFormValid = name.trim().length > 0;
  const isCompanyType = role === 'Vendor' || role === 'Partner';

  const handleSave = () => {
    if (!isFormValid || submitting) return;
    const payload = {
      name: name.trim(),
      role,
      email: email.trim(),
      phone: phone.trim(),
      org: org.trim(),
      notes: notes.trim(),
    };
    if (isEditMode && onUpdate) {
      onUpdate(payload);
    } else {
      onSave(payload);
    }
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
            {/* Interactive Left-Aligned Role Selector (Noise-Free, Matches EventComposeModal) */}
            <Pressable
              onPress={() => setShowRolePicker(true)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.headerPill,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.headerPillText, { color: '#000000' }]}>
                {role}
              </Text>
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
                placeholder={isCompanyType || role === 'Company' ? 'Company Name *' : 'Full Name *'}
                placeholderTextColor={theme?.dark ? '#a1a1aa' : '#52525b'}
                autoFocus
              />
            </View>

            {/* Row 2: Phone */}
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                value={phone}
                keyboardType="phone-pad"
                onChangeText={setPhone}
                placeholder="Phone number"
                placeholderTextColor={theme?.dark ? '#a1a1aa' : '#52525b'}
              />
            </View>

            {/* Row 3: Email */}
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                value={email}
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor={theme?.dark ? '#a1a1aa' : '#52525b'}
              />
            </View>

            {/* Row 4: Dynamic Field (Job Title for Staff, Address/Website for Company, Company for Customer) */}
            {role === 'Staff' ? (
              <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                <TextInput
                  style={[styles.fieldInput, { color: theme.text, flex: 1 }]}
                  value={org}
                  onChangeText={setOrg}
                  placeholder="Job Title / Department (e.g. Sales Lead)"
                  placeholderTextColor={theme?.dark ? '#a1a1aa' : '#52525b'}
                />
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  if (!isCompanyType && role !== 'Company') {
                    setShowCompanyPicker(true);
                  }
                }}
                style={[styles.fieldRow, { borderBottomColor: theme.border }]}
              >
                {org.trim().length > 0 && !isCompanyType && role !== 'Company' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingVertical: 4 }}>
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: '#bae6fd',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>
                        {org.trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: theme.text, flex: 1 }} numberOfLines={1}>
                      {org}
                    </Text>
                  </View>
                ) : (
                  <TextInput
                    style={[styles.fieldInput, { color: theme.text, flex: 1 }]}
                    value={org}
                    onChangeText={setOrg}
                    placeholder={isCompanyType || role === 'Company' ? 'Address / Website' : 'Company / Organization'}
                    placeholderTextColor={theme?.dark ? '#a1a1aa' : '#52525b'}
                    pointerEvents={!isCompanyType && role !== 'Company' ? 'none' : 'auto'}
                    editable={isCompanyType || role === 'Company'}
                  />
                )}
              </Pressable>
            )}

            {/* Row 5: Notes & Description */}
            <View style={styles.bodyContainer}>
              <TextInput
                style={[styles.bodyInput, { color: theme.text }]}
                multiline
                value={notes}
                onChangeText={setNotes}
                placeholder="Notes or description..."
                placeholderTextColor={theme?.dark ? '#a1a1aa' : '#52525b'}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* Options Selection Modal — FULL SCREEN Presentation (Matches EventComposeModal) */}
      <Modal
        visible={showRolePicker}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowRolePicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: Math.max(insets.top, 12), paddingHorizontal: 16 }}>
          {/* Header Bar */}
          <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border + '40', marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Select Contact Role</Text>
            <TouchableOpacity onPress={() => setShowRolePicker(false)} hitSlop={10}>
              <Ionicons name="close" size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 32) }}>
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
                    {typeObj.subtitle ? (
                      <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                        {typeObj.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected && <Ionicons name="checkmark" size={18} color={theme.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* Selectable Company / Organization Modal */}
      <Modal
        visible={showCompanyPicker}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowCompanyPicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: Math.max(insets.top, 12), paddingHorizontal: 16 }}>
          {/* Header Bar */}
          <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border + '40', marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Select Company</Text>
            <TouchableOpacity onPress={() => setShowCompanyPicker(false)} hitSlop={10}>
              <Ionicons name="close" size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 32) }}>
            {(() => {
              const rawCompanies = (allEntities || []).filter((e: any) => {
                const t = (e.type || e.category || '').toLowerCase();
                const r = (e.role || e.subtype || '').toLowerCase();
                return t === 'company' || t === 'business' || r === 'company' || r === 'vendor' || r === 'partner';
              });

              // Deduplicate by normalized name
              const uniqueMap = new Map<string, any>();
              rawCompanies.forEach((comp: any) => {
                const compName = (comp.title || comp.name || comp.data?.name || comp.data?.title || '').trim();
                if (compName && !uniqueMap.has(compName.toLowerCase())) {
                  uniqueMap.set(compName.toLowerCase(), { ...comp, displayName: compName });
                }
              });

              const uniqueCompanies = Array.from(uniqueMap.values());

              if (uniqueCompanies.length === 0) {
                return (
                  <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, color: theme.textMuted }}>No registered companies found.</Text>
                  </View>
                );
              }

              const PASTEL_COLORS = ['#ddd6fe', '#bae6fd', '#fef08a', '#e2e8f0', '#fed7aa', '#bbf7d0', '#fbcfe8'];
              const getAvatarColor = (nameStr: string) => {
                let hash = 0;
                for (let i = 0; i < nameStr.length; i++) hash = nameStr.charCodeAt(i) + ((hash << 5) - hash);
                return PASTEL_COLORS[Math.abs(hash) % PASTEL_COLORS.length];
              };

              return uniqueCompanies.map((comp: any) => {
                const compName = comp.displayName;
                const isSelected = org.trim().toLowerCase() === compName.toLowerCase();
                const initial = compName.charAt(0).toUpperCase() || 'C';
                const avatarColor = getAvatarColor(compName);
                const subText = comp.data?.industry || comp.data?.org || comp.subtype || comp.role || 'Company';

                return (
                  <Pressable
                    key={comp.id || compName}
                    onPress={() => {
                      setOrg(compName);
                      setShowCompanyPicker(false);
                    }}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingVertical: 12,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: theme.border + '40',
                        backgroundColor: pressed ? theme.border + '20' : isSelected ? theme.primary + '10' : 'transparent',
                      },
                    ]}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: avatarColor, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e293b' }}>{initial}</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: isSelected ? '700' : '600', color: isSelected ? theme.primary : theme.text }}>
                        {compName}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                        {subText}
                      </Text>
                    </View>
                  </Pressable>
                );
              });
            })()}
          </ScrollView>
        </View>
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
    gap: 4,
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  headerPillText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
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
