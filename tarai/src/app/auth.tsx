import { StyleSheet, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { signInWithGoogle, getCurrentUser } from '@/lib/auth';

const SOLUTIONS = [
  { icon: 'ellipse-outline' as const, label: 'Projects & Tasks' },
  { icon: 'cube-outline' as const, label: 'Supply chain' },
  { icon: 'cart-outline' as const, label: 'Commerce' },
  { icon: 'globe-outline' as const, label: 'Sites' },
  { icon: 'bulb-outline' as const, label: 'AI' },
];

export default function AuthScreen() {
  console.log('[AUTH] Component rendered');
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('[AUTH] useEffect - checking current user');
    (async () => {
      try {
        const user = await getCurrentUser();
        console.log('[AUTH] getCurrentUser result:', user ? user.email : 'null');
        if (user) {
          console.log('[AUTH] User found, navigating to /(nav)');
          router.replace('/(nav)');
        } else {
          console.log('[AUTH] No user, staying on auth screen');
        }
      } catch (_e) { /* ignore */ }
    })();
  }, [router]);

  const handleGoogleAuth = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/(nav)');
    } catch (e: any) {
      console.warn('[Auth] Google sign-in failed:', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.content, { paddingTop: insets.top + 80 }]}>

        <Text style={[styles.title, { color: theme.text }]}>tar.</Text>
        <Text style={[styles.subtitle, { color: theme.text }]}>Everything app</Text>

      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.solutions}>
          {SOLUTIONS.map((item) => (
            <View key={item.label} style={styles.solutionRow}>
              <Ionicons name={item.icon} size={22} color={theme.text} />
              <Text style={[styles.solutionLabel, { color: theme.text }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />

        <Pressable
          style={[styles.authButton, { backgroundColor: theme.backgroundElement }]}
          onPress={handleGoogleAuth}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.text} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={theme.text} />
              <Text style={[styles.authButtonText, { color: theme.text }]}>Continue with Google</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 32, justifyContent: 'flex-start' },
  title: { fontSize: 64, fontWeight: '800', letterSpacing: -2 },
  subtitle: { fontSize: 28, fontWeight: '700', marginTop: 4 },
  bottom: { paddingHorizontal: 32 },
  solutions: { gap: 16 },
  solutionRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  solutionLabel: { fontSize: 20, fontWeight: '500' },
  authButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, gap: 12, marginBottom: 48 },
  authButtonText: { fontSize: 16, fontWeight: '600' },
});
