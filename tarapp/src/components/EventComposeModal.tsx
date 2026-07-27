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
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface EventComposeModalProps {
  visible: boolean;
  action: any | null;
  formParams: Record<string, string>;
  theme: any;
  submitting: boolean;
  resultMessage: string | null;
  onClose: () => void;
  onSubmit: (params: Record<string, string>) => void;
}

export default function EventComposeModal({
  visible,
  action,
  formParams,
  theme,
  submitting,
  resultMessage,
  onClose,
  onSubmit,
}: EventComposeModalProps) {
  const insets = useSafeAreaInsets();
  const [params, setParams] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (formParams) {
      setParams({ ...formParams });
    }
  }, [formParams]);

  if (!visible || !action) return null;

  const actionName = action?.name?.replace(/_/g, ' ') || 'Record Event';
  const paramList: any[] = action?.params || [];

  // Group params into plan5.md concepts: To (target), Items (what), Values (amount/price), Details (reason/notes)
  const targetParams = paramList.filter((p) => {
    const name = (typeof p === 'string' ? p : p.name).toLowerCase();
    return name.includes('customer') || name.includes('client') || name.includes('contact') || name.includes('user') || name.includes('staff') || name.includes('assignee');
  });

  const itemParams = paramList.filter((p) => {
    const name = (typeof p === 'string' ? p : p.name).toLowerCase();
    return name.includes('item') || name.includes('product') || name.includes('service') || name.includes('order') || name.includes('booking') || name.includes('shipment');
  });

  const valueParams = paramList.filter((p) => {
    const name = (typeof p === 'string' ? p : p.name).toLowerCase();
    return name.includes('total') || name.includes('amount') || name.includes('price') || name.includes('cost') || name.includes('qty') || name.includes('stock') || name.includes('value');
  });

  const otherParams = paramList.filter((p) => {
    const name = (typeof p === 'string' ? p : p.name).toLowerCase();
    return !targetParams.includes(p) && !itemParams.includes(p) && !valueParams.includes(p);
  });

  const handleTextChange = (paramName: string, val: string) => {
    setParams((prev) => ({ ...prev, [paramName]: val }));
  };

  const handleSend = () => {
    onSubmit(params);
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
            <View style={styles.headerLeft}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Compose Event</Text>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={handleSend}
                disabled={submitting}
                hitSlop={8}
                style={styles.sendTextBtn}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Text style={[styles.sendText, { color: theme.primary }]}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Result Banner Toast */}
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

          {/* Form Content Scroll Area */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollBody, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Action Event Row — Simple clean text, no pill, no icon, no background color */}
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Event</Text>
              <Text style={[styles.fieldTextValue, { color: theme.text, fontWeight: '500' }]}>
                {actionName}
              </Text>
            </View>

            {/* FROM Field */}
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>From</Text>
              <Text style={[styles.fieldTextValue, { color: theme.text }]}>
                Staff Member <Text style={{ color: theme.textMuted }}>(&lt;staff@workspace&gt;)</Text>
              </Text>
            </View>

            {/* TO / Target Params */}
            {targetParams.map((p) => {
              const paramName = typeof p === 'string' ? p : p.name;
              return (
                <View key={paramName} style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>To</Text>
                  <TextInput
                    style={[styles.fieldInput, { color: theme.text }]}
                    value={params[paramName] || ''}
                    onChangeText={(val) => handleTextChange(paramName, val)}
                    placeholder={`Specify ${paramName.replace(/_/g, ' ')}...`}
                    placeholderTextColor={theme.textMuted + '80'}
                  />
                </View>
              );
            })}

            {/* Item Params */}
            {itemParams.map((p) => {
              const paramName = typeof p === 'string' ? p : p.name;
              return (
                <View key={paramName} style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Item</Text>
                  <TextInput
                    style={[styles.fieldInput, { color: theme.text }]}
                    value={params[paramName] || ''}
                    onChangeText={(val) => handleTextChange(paramName, val)}
                    placeholder={`Enter ${paramName.replace(/_/g, ' ')}...`}
                    placeholderTextColor={theme.textMuted + '80'}
                  />
                </View>
              );
            })}

            {/* Value / Amount Params */}
            {valueParams.map((p) => {
              const paramName = typeof p === 'string' ? p : p.name;
              return (
                <View key={paramName} style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Value</Text>
                  <TextInput
                    style={[styles.fieldInput, { color: theme.text, fontWeight: '600' }]}
                    value={params[paramName] || ''}
                    keyboardType="numeric"
                    onChangeText={(val) => handleTextChange(paramName, val)}
                    placeholder={`Set ${paramName.replace(/_/g, ' ')}...`}
                    placeholderTextColor={theme.textMuted + '80'}
                  />
                </View>
              );
            })}

            {/* Other Params */}
            {otherParams.map((p) => {
              const paramName = typeof p === 'string' ? p : p.name;
              return (
                <View key={paramName} style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
                    {paramName.replace(/_/g, ' ')}
                  </Text>
                  <TextInput
                    style={[styles.fieldInput, { color: theme.text }]}
                    value={params[paramName] || ''}
                    onChangeText={(val) => handleTextChange(paramName, val)}
                    placeholder={`Enter ${paramName.replace(/_/g, ' ')}...`}
                    placeholderTextColor={theme.textMuted + '80'}
                  />
                </View>
              );
            })}

            {/* Compose Body / Notes */}
            <View style={styles.bodyContainer}>
              <TextInput
                style={[styles.bodyInput, { color: theme.text }]}
                multiline
                value={notes}
                onChangeText={setNotes}
                placeholder="Compose event details, notes, or motion description..."
                placeholderTextColor={theme.textMuted + '80'}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendTextBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sendText: {
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
    gap: 16,
  },
  fieldLabel: {
    width: 70,
    fontSize: 14,
    fontWeight: '500',
  },
  fieldTextValue: {
    flex: 1,
    fontSize: 15,
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
});
