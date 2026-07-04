import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getCurrentUser } from '@/lib/auth';

const TARFLUE_URL = process.env.EXPO_PUBLIC_TARFLUE_URL || 'https://tarflue.tar-54d.workers.dev';

const BUSINESS_TYPES = [
  { id: 'restaurant', icon: 'restaurant-outline', label: 'Food Business' },
  { id: 'salon', icon: 'cut-outline', label: 'Salon or Spa' },
  { id: 'clinic', icon: 'medical-outline', label: 'Clinic or Hospital' },
  { id: 'retail', icon: 'cart-outline', label: 'Retail Store' },
  { id: 'gym', icon: 'barbell-outline', label: 'Gym or Fitness' },
  { id: 'agency', icon: 'briefcase-outline', label: 'Agency or Office' },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [workspaceUrl, setWorkspaceUrl] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim() || !businessType) return;
    setCreating(true);
    setError('');
    try {
      const user = await getCurrentUser();
      const subdomain = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const res = await fetch(`${TARFLUE_URL}/workspaces/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': user?.id || 'guest' },
        body: JSON.stringify({ name, template: businessType, subdomain }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create workspace');
        return;
      }
      setWorkspaceUrl(data.url || `https://${subdomain}.tarai.space`);
      setCreated(true);
    } catch (e: any) {
      setError(e.message || 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      {step === 1 && (
        <>
          <Text style={[styles.title, { color: theme.text }]}>Welcome to tarai!</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>What best describes you?</Text>
          <View style={styles.options}>
            {BUSINESS_TYPES.map((bt) => (
              <Pressable
                key={bt.id}
                style={[
                  styles.option,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  businessType === bt.id && { borderColor: theme.primary, backgroundColor: theme.primary + '10' },
                ]}
                onPress={() => { setBusinessType(bt.id); setStep(2); }}>
                <Ionicons name={bt.icon as any} size={24} color={businessType === bt.id ? theme.primary : theme.text} />
                <Text style={[styles.optionLabel, { color: theme.text }]}>{bt.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => router.replace('/(tabs)/home' as any)}>
            <Text style={[styles.skip, { color: theme.textMuted }]}>Skip — I'll explore first</Text>
          </Pressable>
        </>
      )}

      {step === 2 && !created && (
        <>
          <Text style={[styles.title, { color: theme.text }]}>Tell us about your business</Text>
          <Text style={[styles.label, { color: theme.text }]}>Business name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border }]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Happy Bites"
            placeholderTextColor={theme.textMuted}
          />
          {error ? (
            <Text style={[styles.error, { color: '#f44336' }]}>{error}</Text>
          ) : null}
          <Pressable
            style={[styles.createButton, { backgroundColor: name.trim() ? theme.primary : theme.backgroundElement }]}
            onPress={handleCreate}
            disabled={!name.trim() || creating}>
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.createButtonText, { color: name.trim() ? '#fff' : theme.textMuted }]}>
                Create Workspace
              </Text>
            )}
          </Pressable>
        </>
      )}

      {created && (
        <View style={styles.success}>
          <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
          <Text style={[styles.successTitle, { color: theme.text }]}>Workspace is live!</Text>
          <Text style={[styles.successUrl, { color: theme.primary }]}>{workspaceUrl}</Text>
          <Text style={[styles.successHint, { color: theme.textMuted }]}>
            Your workspace is ready. You can customize it in Chat.
          </Text>
          <Pressable
            style={[styles.createButton, { backgroundColor: theme.primary, marginTop: 32 }]}
            onPress={() => router.replace('/(tabs)/home' as any)}>
            <Text style={[styles.createButtonText, { color: '#fff' }]}>Go to Home</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 80 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 24, color: '#666' },
  options: { gap: 12 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, gap: 12 },
  optionLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  skip: { fontSize: 14, textAlign: 'center', marginTop: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16 },
  error: { fontSize: 14, marginBottom: 16 },
  createButton: { padding: 16, borderRadius: 12, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  createButtonText: { fontSize: 16, fontWeight: '600' },
  success: { alignItems: 'center', paddingTop: 60 },
  successTitle: { fontSize: 24, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  successUrl: { fontSize: 16, fontWeight: '500', marginBottom: 8 },
  successHint: { fontSize: 14, textAlign: 'center' },
});
