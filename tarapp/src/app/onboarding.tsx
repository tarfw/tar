import { StyleSheet, View, Text, Pressable, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { tar } from '@/lib/tar';
import { VERTICALS, resolveModules } from '@/lib/verticals';

const VERTICAL_OPTIONS = [
  { key: 'restaurant', label: 'Restaurant / Food', icon: 'restaurant-outline' },
  { key: 'salon', label: 'Salon / Spa', icon: 'cut-outline' },
  { key: 'clinic', label: 'Clinic / Hospital', icon: 'medical-outline' },
  { key: 'retail', label: 'Retail Store', icon: 'cart-outline' },
  { key: 'courier', label: 'Courier / Delivery', icon: 'bicycle-outline' },
  { key: 'agency', label: 'Agency / Office', icon: 'briefcase-outline' },
  { key: 'gym', label: 'Gym / Fitness', icon: 'barbell-outline' },
  { key: 'school', label: 'School / Education', icon: 'school-outline' },
  { key: 'property', label: 'Property', icon: 'home-outline' },
  { key: 'home-services', label: 'Home Services', icon: 'hammer-outline' },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [selectedVertical, setSelectedVertical] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [services, setServices] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ scope: string; subdomain: string } | null>(null);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!businessName.trim() || !selectedVertical) return;
    setCreating(true);
    setError('');
    try {
      const subdomain = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const result = await tar.createWorkspace({
        name: businessName.trim(),
        template: selectedVertical,
        subdomain,
      });

      setCreated({ scope: result.scope, subdomain });
      setStep(3);
    } catch (e: any) {
      setError(e.message || 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  // Step 3 — confirmation
  if (step === 3 && created) {
    const mods = resolveModules(VERTICALS[selectedVertical]?.modules || []);
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.content, { paddingTop: insets.top + 80 }]}>
          <Ionicons name="checkmark-circle" size={64} color={theme.primary} />
          <Text style={[styles.title, { color: theme.text, marginTop: 16 }]}>Workspace is live!</Text>
          <Text style={[styles.subtitle, { color: theme.text, fontSize: 20, marginTop: 8 }]}>
            {businessName}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted, fontSize: 14, marginTop: 4 }]}>
            {created.subdomain}.tarai.space
          </Text>

          <View style={[styles.moduleList, { marginTop: 24 }]}>
            <Text style={[styles.label, { color: theme.textMuted }]}>INSTALLED MODULES</Text>
            {mods.map((m) => (
              <View key={m} style={[styles.moduleChip, { backgroundColor: theme.primary + '15' }]}>
                <Text style={[styles.moduleChipText, { color: theme.primary }]}>{m}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => router.replace('/(tabs)/explore')}>
            <Text style={[styles.buttonText, { color: '#fff' }]}>Go to Explore</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.content, { paddingTop: insets.top + 80 }]}>
        <Text style={[styles.title, { color: theme.text }]}>tar.</Text>

        {step === 1 ? (
          <>
            <Text style={[styles.subtitle, { color: theme.text }]}>What do you do?</Text>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingTop: 8 }}>
              {VERTICAL_OPTIONS.map((v) => (
                <Pressable
                  key={v.key}
                  style={[
                    styles.verticalOption,
                    {
                      backgroundColor: selectedVertical === v.key ? theme.primary + '20' : theme.backgroundElement,
                      borderColor: selectedVertical === v.key ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setSelectedVertical(v.key)}>
                  <Ionicons name={v.icon as any} size={22} color={selectedVertical === v.key ? theme.primary : theme.textMuted} />
                  <Text style={[styles.verticalLabel, { color: selectedVertical === v.key ? theme.primary : theme.text }]}>
                    {v.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: theme.text }]}>Name your workspace</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border }]}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder='e.g. "Happy Bites"'
              placeholderTextColor={theme.textMuted}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border, marginTop: 12 }]}
              value={services}
              onChangeText={setServices}
              placeholder='Services (optional, comma separated)'
              placeholderTextColor={theme.textMuted}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        )}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {step === 1 ? (
          <Pressable
            style={[styles.button, { backgroundColor: selectedVertical ? theme.primary : theme.backgroundElement }]}
            onPress={() => setStep(2)}
            disabled={!selectedVertical}>
            <Text style={[styles.buttonText, { color: selectedVertical ? '#fff' : theme.textMuted }]}>
              Continue
            </Text>
          </Pressable>
        ) : (
          <View style={{ gap: 8 }}>
            <Pressable
              style={[styles.button, { backgroundColor: businessName.trim() ? theme.primary : theme.backgroundElement }]}
              onPress={handleCreate}
              disabled={!businessName.trim() || creating}>
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.buttonText, { color: businessName.trim() ? '#fff' : theme.textMuted }]}>
                  Create Workspace
                </Text>
              )}
            </Pressable>
            <Pressable style={styles.backButton} onPress={() => setStep(1)}>
              <Text style={[styles.backText, { color: theme.textMuted }]}>Back</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 32, justifyContent: 'flex-start' },
  title: { fontSize: 64, fontWeight: '800', letterSpacing: -2 },
  subtitle: { fontSize: 28, fontWeight: '700', marginTop: 4, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  input: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, fontSize: 16, borderWidth: 1 },
  verticalOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  verticalLabel: { fontSize: 15, fontWeight: '500' },
  moduleList: { gap: 6 },
  moduleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  moduleChipText: { fontSize: 13, fontWeight: '600' },
  bottom: { paddingHorizontal: 32 },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  backButton: { paddingVertical: 12, alignItems: 'center' },
  backText: { fontSize: 14, fontWeight: '500' },
  error: { fontSize: 14, color: '#f44336', marginTop: 12 },
});
