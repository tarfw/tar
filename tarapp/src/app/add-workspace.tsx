import { StyleSheet, View, Text, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Dimensions, Alert, Keyboard, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { tar } from '@/lib/tar';

const PRESETS: Record<string, { label: string; icon: string; modules: string[] }> = {
  restaurant: {
    label: 'Restaurant / Cafe',
    icon: 'restaurant-outline',
    modules: ['orders', 'inventory', 'bookings', 'crm', 'reports', 'expenses', 'documents'],
  },
  salon: {
    label: 'Salon / Spa',
    icon: 'cut-outline',
    modules: ['bookings', 'crm', 'orders', 'reports', 'expenses', 'documents'],
  },
  clinic: {
    label: 'Clinic / Medical',
    icon: 'medical-outline',
    modules: ['bookings', 'crm', 'projects', 'support', 'reports', 'expenses', 'documents'],
  },
  retail: {
    label: 'Retail Shop',
    icon: 'cart-outline',
    modules: ['orders', 'inventory', 'crm', 'reports', 'expenses', 'documents'],
  },
  gym: {
    label: 'Gym / Fitness',
    icon: 'barbell-outline',
    modules: ['bookings', 'crm', 'lms', 'hr', 'reports', 'expenses', 'documents'],
  },
  agency: {
    label: 'Office / Agency',
    icon: 'briefcase-outline',
    modules: ['crm', 'projects', 'hr', 'support', 'reports', 'expenses', 'documents'],
  },
};

const ALL_MODULES = [
  'orders',
  'inventory',
  'bookings',
  'crm',
  'logistics',
  'projects',
  'hr',
  'lms',
  'listings',
  'support',
  'reports',
  'expenses',
  'documents',
  'team-chat',
];

export default function AddWorkspaceScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  const [step, setStep] = useState(1); // 1 = setup, 2 = success
  const [businessName, setBusinessName] = useState('');
  const [businessFocus, setBusinessFocus] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('restaurant');
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set(PRESETS.restaurant.modules));
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ scope: string; subdomain: string } | null>(null);
  const [error, setError] = useState('');
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    tar.listWorkspaces()
      .then((data) => {
        if (data?.workspaces && data.workspaces.length > 0) {
          setHasExisting(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectPreset = (key: string) => {
    setSelectedPreset(key);
    setSelectedModules(new Set(PRESETS[key].modules));
  };

  const handleToggleModule = (mod: string) => {
    const next = new Set(selectedModules);
    if (next.has(mod)) {
      next.delete(mod);
    } else {
      next.add(mod);
    }
    setSelectedModules(next);
  };

  const handleCreate = async () => {
    if (!businessName.trim() || !businessFocus.trim() || selectedModules.size === 0) return;
    Keyboard.dismiss();
    setCreating(true);
    setError('');
    try {
      const subdomain = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const result = await tar.createWorkspace({
        name: businessName.trim(),
        template: selectedPreset,
        subdomain,
        description: businessFocus.trim(),
        modules: Array.from(selectedModules),
      } as any);

      // Mark onboarding as done
      const userId = await SecureStore.getItemAsync('google_auth_user')
        .then((u) => (u ? JSON.parse(u).id : null))
        .catch(() => null);
      if (userId) {
        await SecureStore.setItemAsync(`onb_${userId}`, 'true');
      }
      await SecureStore.setItemAsync('active_workspace_subdomain', subdomain);
      await SecureStore.setItemAsync('redirect_to_workspaces', 'true');

      setCreated({ scope: result.scope, subdomain });
      setStep(2);
    } catch (e: any) {
      setError(e.message || 'Failed to create workspace');
    } finally {
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

  if (step === 2 && created) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingBottom: insets.bottom + 24, paddingTop: insets.top + 80, paddingHorizontal: 24, justifyContent: 'space-between', alignItems: 'center' }]}>
        <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: 140 }}>
          <Ionicons name="checkmark-circle" size={80} color={theme.primary} />
          <Text style={[styles.titleSuccess, { color: theme.text, marginTop: 24 }]}>Workspace is live!</Text>
          <Text style={[styles.urlText, { color: theme.textMuted, marginTop: 8 }]}>
            {created.subdomain}.tarai.space
          </Text>
        </View>

        <View style={{ width: '100%', paddingBottom: 16 }}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: theme.primary,
                opacity: pressed ? 0.75 : 1,
              }
            ]}
            onPress={() => {
              try {
                router.replace('/(tabs)/workspaces');
              } catch (e1) {
                console.warn('[AddWorkspace] Redirect to /(tabs)/workspaces failed, trying /workspaces:', e1);
                try {
                  router.replace('/workspaces');
                } catch (e2) {
                  console.warn('[AddWorkspace] Redirect to /workspaces failed, trying /(tabs)/inbox:', e2);
                  try {
                    router.replace('/(tabs)/inbox');
                  } catch (e3) {
                    console.warn('[AddWorkspace] Redirect to /(tabs)/inbox failed, trying /inbox:', e3);
                    try {
                      router.replace('/inbox');
                    } catch (e4) {
                      console.warn('[AddWorkspace] Redirect to /inbox failed, falling back to /:', e4);
                      router.replace('/');
                    }
                  }
                }
              }
            }}>
            <Text style={[styles.buttonText, { color: '#fff' }]}>Open Workspace</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const canCreate = businessName.trim() && businessFocus.trim() && selectedModules.size > 0 && !creating;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <View style={[styles.content, { paddingTop: insets.top + 24 }]}>
          
          {/* Header Row with optional Back Arrow */}
          <View style={styles.headerRow}>
            {hasExisting ? (
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 24 }} />
            )}
            <Text style={[styles.headerTitle, { color: theme.text }]}>Add Workspace</Text>
            <View style={{ width: 24 }} />
          </View>

          <Text style={{ color: theme.textMuted, fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 24 }}>
            Create a new customized AI agent workspace
          </Text>

          <View style={{ gap: 16 }}>
            <TextInput
              style={[styles.titleInput, { color: theme.text, borderBottomColor: theme.border, borderBottomWidth: 1 }]}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Business / Workspace Name"
              placeholderTextColor={theme.textMuted}
              editable={!creating}
            />

            <TextInput
              style={[styles.bodyInput, { color: theme.text, borderBottomColor: theme.border, borderBottomWidth: 1 }]}
              value={businessFocus}
              onChangeText={setBusinessFocus}
              placeholder="What does your business do? (e.g. sourdough bakery and cafe)"
              placeholderTextColor={theme.textMuted}
              editable={!creating}
              multiline
              numberOfLines={3}
            />

            {/* Business Presets */}
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Select Business Preset</Text>
              <View style={styles.presetsGrid}>
                {Object.entries(PRESETS).map(([key, info]) => {
                  const isSelected = selectedPreset === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.presetCard,
                        {
                          borderColor: isSelected ? theme.primary : theme.border,
                          backgroundColor: isSelected ? `${theme.primary}10` : 'transparent',
                        },
                      ]}
                      onPress={() => handleSelectPreset(key)}
                      disabled={creating}
                    >
                      <Ionicons
                        name={info.icon as any}
                        size={24}
                        color={isSelected ? theme.primary : theme.textMuted}
                      />
                      <Text
                        style={[
                          styles.presetLabel,
                          {
                            color: isSelected ? theme.primary : theme.text,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {info.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Modules / Features Selection */}
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Configure Features</Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, marginBottom: 12 }}>
                Select modules to generate. Recommended features are pre-selected.
              </Text>
              <View style={styles.chipsContainer}>
                {ALL_MODULES.map((mod) => {
                  const isSelected = selectedModules.has(mod);
                  return (
                    <TouchableOpacity
                      key={mod}
                      style={[
                        styles.chip,
                        {
                          borderColor: isSelected ? theme.primary : theme.border,
                          backgroundColor: isSelected ? theme.primary : 'transparent',
                        },
                      ]}
                      onPress={() => handleToggleModule(mod)}
                      disabled={creating}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color="#fff" style={{ marginRight: 4 }} />
                      )}
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isSelected ? '#fff' : theme.text,
                            fontWeight: isSelected ? '600' : '400',
                          },
                        ]}
                      >
                        {mod.replace('-', ' ')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>

      {/* Fixed Bottom Button bar */}
      <View style={[styles.floatingBottom, { paddingBottom: insets.bottom + 16, backgroundColor: theme.background }]}>
        <TouchableOpacity
          activeOpacity={canCreate ? 0.7 : 1}
          style={[styles.button, { backgroundColor: canCreate ? theme.primary : theme.border }]}
          onPress={handleCreate}
          disabled={!canCreate}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.buttonText, { color: canCreate ? '#fff' : theme.textMuted }]}>
              Generate Workspace
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  titleSuccess: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  urlText: { fontSize: 16, textAlign: 'center' },
  titleInput: {
    fontSize: 20,
    fontWeight: '700',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 0,
  },
  bodyInput: {
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 0,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetCard: {
    width: (Dimensions.get('window').width - 64) / 2,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  presetLabel: {
    fontSize: 13,
    textAlign: 'center',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
  },
  bottom: { paddingHorizontal: 24 },
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
});
