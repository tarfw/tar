import { StyleSheet, View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { tar } from '@/lib/tar';

function detectVerticalLocally(text: string): string {
  const t = text.toLowerCase();
  if (/\b(pizza|food|cafe|bakery|coffee|restaurant|burger|sushi|dining|bar|kitchen|meal|bake|chef|eats|diner|bites|sourdough|bread|pastry)\b/.test(t)) {
    return 'Restaurant / Food';
  }
  if (/\b(hair|salon|spa|nail|beauty|massage|barber|grooming|makeup|pedicure|manicure|cut)\b/.test(t)) {
    return 'Salon / Spa';
  }
  if (/\b(doctor|clinic|dentist|braces|teeth|medical|hospital|health|therapy|physio|dentistry|dental)\b/.test(t)) {
    return 'Clinic / Hospital';
  }
  if (/\b(shop|store|sell|buy|product|boutique|clothe|shoe|grocer|goods|market|watch|merch|clothing|apparel|retail)\b/.test(t)) {
    return 'Retail Store';
  }
  if (/\b(delivery|courier|shipping|logistics|cargo|parcel|rider|ship)\b/.test(t)) {
    return 'Courier / Delivery';
  }
  if (/\b(agency|consulting|design|marketing|software|office|firm|dev|studio)\b/.test(t)) {
    return 'Agency / Office';
  }
  if (/\b(gym|fitness|yoga|workout|trainer|training|crossfit|pilates|barbell)\b/.test(t)) {
    return 'Gym / Fitness';
  }
  if (/\b(school|tutor|education|class|course|teach|learn|academy|college)\b/.test(t)) {
    return 'School / Education';
  }
  if (/\b(real estate|property|rent|apartment|house|leasing|landlord|realtor)\b/.test(t)) {
    return 'Property';
  }
  if (/\b(plumbing|cleaner|carpentry|maintenance|repair|handyman|electrical|fix|carpenter|plumber)\b/.test(t)) {
    return 'Home Services';
  }
  return '';
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  const [step, setStep] = useState(1); // 1 = setup, 2 = success
  const [businessName, setBusinessName] = useState('');
  const [businessFocus, setBusinessFocus] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ scope: string; subdomain: string } | null>(null);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!businessName.trim() || !businessFocus.trim()) return;
    setCreating(true);
    setError('');
    try {
      const subdomain = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const result = await tar.createWorkspace({
        name: businessName.trim(),
        template: 'auto',
        subdomain,
        description: businessFocus.trim(),
      });

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

  // Screen 2 — success confirmation
  if (step === 2 && created) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.content, { paddingTop: insets.top + 100, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="checkmark-circle" size={80} color={theme.primary} />
          <Text style={[styles.titleSuccess, { color: theme.text, marginTop: 24 }]}>Workspace is live!</Text>
          <Text style={[styles.urlText, { color: theme.textMuted, marginTop: 8 }]}>
            {created.subdomain}.tarai.space
          </Text>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => {
              console.log(`[Onboarding] Open Workspace pressed for "${created.subdomain}". Redirecting to /inbox`);
              try {
                router.replace('/inbox');
              } catch (e) {
                console.warn('[Onboarding] Direct /inbox failed, falling back to /:', e);
                router.replace('/');
              }
            }}>
            <Text style={[styles.buttonText, { color: '#fff' }]}>Open Workspace</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Screen 1 — Notion-style setup
  const canCreate = businessName.trim() && businessFocus.trim() && !creating;
  const detectedVertical = detectVerticalLocally(businessFocus);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.content, { paddingTop: insets.top + 80 }]}>
        <Text style={[styles.title, { color: theme.text }]}>tar.</Text>
        
        <View style={{ marginTop: 32, gap: 16 }}>
          <TextInput
            style={[styles.titleInput, { color: theme.text }]}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Workspace Name"
            placeholderTextColor={theme.textMuted}
            editable={!creating}
            autoFocus
          />
          
          <View style={{ height: 1, backgroundColor: theme.border, opacity: 0.5 }} />

          <TextInput
            style={[styles.bodyInput, { color: theme.text }]}
            value={businessFocus}
            onChangeText={setBusinessFocus}
            placeholder="What does your business do? (e.g. sourdough bakery and cafe)"
            placeholderTextColor={theme.textMuted}
            editable={!creating}
            multiline
            numberOfLines={4}
          />

          {detectedVertical ? (
            <Text style={[styles.detectedText, { color: theme.textMuted }]}>
              Detected vertical: {detectedVertical}
            </Text>
          ) : null}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24, paddingTop: 12 }]}>
        <TouchableOpacity
          activeOpacity={canCreate ? 0.7 : 1}
          style={[styles.button, { backgroundColor: canCreate ? theme.primary : theme.border }]}
          onPress={handleCreate}
          disabled={!canCreate}>
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.buttonText, { color: canCreate ? '#fff' : theme.textMuted }]}>
              Create Workspace
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 32 },
  title: { fontSize: 48, fontWeight: '800', letterSpacing: -1 },
  titleSuccess: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  urlText: { fontSize: 16, textAlign: 'center' },
  titleInput: {
    fontSize: 32,
    fontWeight: '700',
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderWidth: 0,
  },
  bodyInput: {
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderWidth: 0,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  detectedText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: -8,
  },
  bottom: { paddingHorizontal: 32 },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  error: { fontSize: 14, color: '#f44336', marginTop: 12, textAlign: 'center' },
});
