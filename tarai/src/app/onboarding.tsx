import { StyleSheet, View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { getCurrentUser } from '@/lib/auth';
import { create } from '@/lib/tools';
import { chatCompletion } from '@/lib/ai';
import { VERTICALS } from '@/lib/verticals';

const VERTICAL_LABELS: Record<string, string> = {
  restaurant: 'Restaurant / Food',
  salon: 'Salon / Spa',
  clinic: 'Clinic / Hospital',
  retail: 'Retail Store',
  gym: 'Gym / Fitness',
  agency: 'Agency / Office',
  courier: 'Courier / Logistics',
  school: 'School / Education',
  property: 'Property',
  'home-services': 'Home Services',
  general: 'General Business',
};

const VERTICAL_ICONS: Record<string, string> = {
  restaurant: 'restaurant-outline',
  salon: 'cut-outline',
  clinic: 'medical-outline',
  retail: 'cart-outline',
  gym: 'barbell-outline',
  agency: 'briefcase-outline',
  courier: 'bicycle-outline',
  school: 'school-outline',
  property: 'home-outline',
  'home-services': 'hammer-outline',
  general: 'briefcase-outline',
};

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [businessInput, setBusinessInput] = useState('');
  const [predictedVertical, setPredictedVertical] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (businessInput.length < 3) {
      setPredictedVertical('');
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const result = await chatCompletion(
          'You classify businesses. Return ONLY a JSON object: { "vertical": "restaurant|salon|clinic|retail|gym|agency|courier|school|property|home-services|general" }',
          businessInput,
        );
        const match = result.match(/\{[^}]+\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          setPredictedVertical(VERTICALS[parsed.vertical] ? parsed.vertical : 'general');
        } else {
          setPredictedVertical('general');
        }
      } catch {
        setPredictedVertical('general');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [businessInput]);

  const handleCreate = async () => {
    if (!businessName.trim() || !predictedVertical) return;
    setCreating(true);
    setError('');
    try {
      const user = await getCurrentUser();
      const userId = user?.id || 'guest';
      const workspaceId = `workspace_${userId}_${Date.now()}`;
      const subdomain = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      await create({
        table: 'form',
        scope: 'w:' + workspaceId,
        type: 'workspace',
        code: subdomain,
        title: businessName,
        data: {
          vertical: predictedVertical,
          modules: VERTICALS[predictedVertical]?.modules || [],
          subdomain,
        },
      });

      // Sync to Turso cloud (with delay for new DBs to propagate)
      try {
        const { pullSync } = await import('@/lib/db');
        await new Promise(r => setTimeout(r, 3000));
        await pullSync(userId);
      } catch (syncErr) {
        console.warn('[Onboarding] sync failed (will retry later):', syncErr);
      }

      await SecureStore.setItemAsync(`onb_${userId}`, 'true');
      router.replace('/(tabs)/inbox');
    } catch (e: any) {
      setError(e.message || 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.content, { paddingTop: insets.top + 80 }]}>
        <Text style={[styles.title, { color: theme.text }]}>tar.</Text>

        {step === 1 ? (
          <>
            <Text style={[styles.subtitle, { color: theme.text }]}>What do you do?</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              value={businessInput}
              onChangeText={setBusinessInput}
              placeholder='e.g. "I run a pizza shop"'
              placeholderTextColor={theme.textMuted}
            />
            {predictedVertical ? (
              <View style={styles.prediction}>
                <Ionicons
                  name={(VERTICAL_ICONS[predictedVertical] || 'briefcase-outline') as any}
                  size={18}
                  color={theme.primary}
                />
                <Text style={[styles.predictionText, { color: theme.primary }]}>
                  {VERTICAL_LABELS[predictedVertical] || predictedVertical}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: theme.text }]}>Name your workspace</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder='e.g. "Happy Bites"'
              placeholderTextColor={theme.textMuted}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        )}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {step === 1 ? (
          <Pressable
            style={[styles.button, { backgroundColor: predictedVertical ? theme.primary : theme.backgroundElement }]}
            onPress={() => setStep(2)}
            disabled={!predictedVertical}>
            <Text style={[styles.buttonText, { color: predictedVertical ? '#fff' : theme.textMuted }]}>
              Continue
            </Text>
          </Pressable>
        ) : (
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
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 32, justifyContent: 'flex-start' },
  title: { fontSize: 64, fontWeight: '800', letterSpacing: -2 },
  subtitle: { fontSize: 28, fontWeight: '700', marginTop: 4, marginBottom: 32 },
  input: { paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12, fontSize: 18 },
  prediction: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingVertical: 8 },
  predictionText: { fontSize: 16, fontWeight: '600' },
  bottom: { paddingHorizontal: 32 },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  error: { fontSize: 14, color: '#f44336', marginTop: 12 },
});
