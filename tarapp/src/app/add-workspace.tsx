import { StyleSheet, View, Text, TouchableOpacity, TextInput, ActivityIndicator, Keyboard, ScrollView } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { tar } from '@/lib/tar';

interface CapabilityChip {
  label: string;
  text: string;
  icon: string;
}

const UNIVERSAL_CAPABILITIES: CapabilityChip[] = [
  { label: 'POS / Sales', text: 'POS / sales recording', icon: 'cash-outline' },
  { label: 'Inventory', text: 'inventory tracking', icon: 'cube-outline' },
  { label: 'CRM', text: 'customer relationship management', icon: 'people-outline' },
  { label: 'Bookings', text: 'appointment booking slots', icon: 'calendar-outline' },
  { label: 'Team Chat', text: 'team chat integration', icon: 'chatbubbles-outline' },
  { label: 'Projects', text: 'project task tracking', icon: 'checkbox-outline' },
];

export default function AddWorkspaceScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  const [businessMessage, setBusinessMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [hasExisting, setHasExisting] = useState(false);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<Array<{ label: string; text: string }>>([]);

  const messageInputRef = useRef<TextInput>(null);

  useEffect(() => {
    tar.listWorkspaces()
      .then((data) => {
        if (data?.workspaces && data.workspaces.length > 0) {
          setHasExisting(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const text = businessMessage.toLowerCase();
    const suggestions: Array<{ label: string; text: string }> = [];

    if (text.length > 2) {
      if (
        (text.includes('cafe') || text.includes('restaurant') || text.includes('shop') || text.includes('store') || text.includes('bakery') || text.includes('boutique') || text.includes('pizza') || text.includes('food')) &&
        !text.includes('inventory')
      ) {
        suggestions.push({ label: '📦 Add Stock/Inventory', text: 'inventory tracking' });
      }
      if (
        (text.includes('cafe') || text.includes('restaurant') || text.includes('shop') || text.includes('store') || text.includes('sale') || text.includes('pizza') || text.includes('pos')) &&
        !text.includes('sales') && !text.includes('pos')
      ) {
        suggestions.push({ label: '💰 Add POS / Sales', text: 'POS / sales recording' });
      }
      if (
        (text.includes('salon') || text.includes('doctor') || text.includes('dentist') || text.includes('clinic') || text.includes('consult') || text.includes('class') || text.includes('book') || text.includes('tutor') || text.includes('appoint')) &&
        !text.includes('booking')
      ) {
        suggestions.push({ label: '📅 Add Appointment Bookings', text: 'appointment booking slots' });
      }
      if (
        (text.includes('client') || text.includes('customer') || text.includes('lead') || text.includes('contact') || text.includes('crm') || text.includes('pipeline')) &&
        !text.includes('crm') && !text.includes('customer relationship')
      ) {
        suggestions.push({ label: '👤 Add CRM / Contacts', text: 'customer relationship management' });
      }
      if (
        (text.includes('team') || text.includes('chat') || text.includes('slack') || text.includes('collab') || text.includes('group')) &&
        !text.includes('chat')
      ) {
        suggestions.push({ label: '💬 Add Team Chat', text: 'team chat integration' });
      }
      if (
        (text.includes('project') || text.includes('task') || text.includes('track') || text.includes('dev') || text.includes('agency')) &&
        !text.includes('project') && !text.includes('task')
      ) {
        suggestions.push({ label: '📋 Add Project Tracking', text: 'project task tracking' });
      }
    }

    setDynamicSuggestions(suggestions);
  }, [businessMessage]);

  const appendCapability = (textToAppend: string) => {
    setBusinessMessage((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) {
        return `A business with ${textToAppend}`;
      }
      if (trimmed.toLowerCase().includes(textToAppend.toLowerCase())) {
        return prev;
      }
      
      const hasModifier = trimmed.toLowerCase().includes('with') || trimmed.toLowerCase().includes('managing') || trimmed.toLowerCase().includes('tracking');
      if (hasModifier) {
        return `${trimmed}, ${textToAppend}`;
      } else {
        return `${trimmed} with ${textToAppend}`;
      }
    });
  };

  const handleCreate = async () => {
    if (!businessMessage.trim() || creating) return;
    Keyboard.dismiss();
    setCreating(true);
    setError('');
    try {
      const subdomain = businessMessage
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 30);

      const workspaceName = subdomain
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      await tar.createWorkspace({
        name: workspaceName,
        subdomain,
        message: businessMessage.trim(),
      });

      const userId = await SecureStore.getItemAsync('google_auth_user')
        .then((u) => (u ? JSON.parse(u).id : null))
        .catch(() => null);
      if (userId) {
        await SecureStore.setItemAsync(`onb_${userId}`, 'true');
      }
      await SecureStore.setItemAsync('active_workspace_subdomain', subdomain);

      // Redirect immediately to the workspaces screen
      try {
        router.replace('/(tabs)/workspaces');
      } catch (e1) {
        console.warn('[AddWorkspace] Redirect to /(tabs)/workspaces failed, trying /workspaces:', e1);
        try {
          router.replace('/workspaces');
        } catch (e2) {
          router.replace('/');
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to create workspace');
      setCreating(false);
    }
  };

  const handleBack = () => {
    if (hasExisting) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/workspaces');
      }
    }
  };

  if (creating) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingTitle, { color: theme.text, marginTop: 24 }]}>Generating Workspace</Text>
        <Text style={[styles.loadingSubtitle, { color: theme.textMuted, marginTop: 8 }]}>
          Building modules and provisioning database...
        </Text>
      </View>
    );
  }

  const canCreate = businessMessage.trim() && !creating;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {hasExisting && (
        <TouchableOpacity onPress={handleBack} style={[styles.backButton, { top: insets.top + 12 }]}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
      )}

      <KeyboardAwareScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
          <Text style={[styles.title, { color: theme.text }]}>Create a Workspace</Text>

          {/* Prompt Canvas Input Box */}
          <View style={[styles.inputCard, { backgroundColor: theme.backgroundElement || '#f8fafc', borderColor: theme.border || 'rgba(0,0,0,0.06)' }]}>
            <TextInput
              ref={messageInputRef}
              style={[styles.textArea, { color: theme.text }]}
              value={businessMessage}
              onChangeText={setBusinessMessage}
              placeholder="Describe your business, store, or project in your own words..."
              placeholderTextColor={theme.textMuted}
              multiline
              autoFocus
              editable={!creating}
            />
          </View>

          {/* Dynamic AI Suggestion Chips (As-You-Type) */}
          {dynamicSuggestions.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>AI Recommendations</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                {dynamicSuggestions.map((item, idx) => (
                  <TouchableOpacity
                    key={`dyn_${idx}`}
                    onPress={() => appendCapability(item.text)}
                    style={[styles.chip, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}
                  >
                    <Text style={[styles.chipText, { color: theme.primary }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Universal Capability Modifiers */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Universal Capabilities</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              {UNIVERSAL_CAPABILITIES.map((item, idx) => (
                <TouchableOpacity
                  key={`uni_${idx}`}
                  onPress={() => appendCapability(item.text)}
                  style={[styles.chip, { backgroundColor: theme.backgroundElement || '#f8fafc', borderColor: theme.border || 'rgba(0,0,0,0.06)' }]}
                >
                  <Ionicons name={item.icon as any} size={14} color={theme.text} style={{ marginRight: 4 }} />
                  <Text style={[styles.chipText, { color: theme.text }]}>+ {item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </KeyboardAwareScrollView>

      {/* Fixed Bottom Button bar */}
      <View style={[styles.floatingBottom, { paddingBottom: insets.bottom + 16, backgroundColor: theme.background }]}>
        <TouchableOpacity
          activeOpacity={canCreate ? 0.7 : 1}
          style={[styles.button, { backgroundColor: canCreate ? theme.primary : theme.border }]}
          onPress={handleCreate}
          disabled={!canCreate}
        >
          <Text style={[styles.buttonText, { color: canCreate ? '#fff' : theme.textMuted }]}>
            Generate Workspace
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20 },
  backButton: {
    position: 'absolute',
    left: 12,
    zIndex: 10,
    padding: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  inputCard: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 130,
    maxHeight: 180,
    padding: 14,
    marginBottom: 20,
  },
  textArea: {
    fontSize: 16,
    lineHeight: 24,
    height: '100%',
    textAlignVertical: 'top',
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  chipsScroll: {
    paddingHorizontal: 4,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  floatingBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  error: { fontSize: 14, color: '#f44336', marginTop: 12, textAlign: 'center' },
  loadingTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  loadingSubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 16 },
});
