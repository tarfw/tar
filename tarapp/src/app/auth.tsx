import { StyleSheet, View, Text, Pressable, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { signInWithGoogle, getCurrentUser, trySilentSignIn } from '@/lib/auth';
import { setUserId } from '@/lib/tar';
import { TarLogo } from '@/components/TarLogo';

const SOLUTIONS = [
  { icon: 'ellipse-outline' as const, label: 'Projects & Tasks' },
  { icon: 'cube-outline' as const, label: 'Supply chain' },
  { icon: 'cart-outline' as const, label: 'Commerce' },
  { icon: 'globe-outline' as const, label: 'Sites' },
  { icon: 'bulb-outline' as const, label: 'AI' },
];

const T0 = Date.now();
function ms() { return `${Date.now() - T0}ms`; }

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const [loading, setLoading] = useState(false);

  const logoHeight = Math.round(windowHeight * 0.28);

  useEffect(() => {
    console.log(`[AUTH] ${ms()} — useEffect START (checking user)`);
    (async () => {
      try {
        const t = Date.now();
        const user = await getCurrentUser();
        console.log(`[AUTH] ${Date.now() - t}ms — getCurrentUser: ${user ? user.email : 'null'}`);
        if (user) {
          const { switchUser } = await import('@/lib/db');
          await switchUser(user.id);
          setUserId(user.id);
          // Check if user has any workspaces in D1
          try {
            const res = await fetch(`${process.env.EXPO_PUBLIC_TARFLUE_URL || 'https://taragent.tar-54d.workers.dev'}/workspaces`, {
              headers: { 'X-User-Id': user.id },
            });
            const data = await res.json();
            const hasWorkspaces = (data.workspaces || []).length > 0;
            console.log(`[AUTH] ${ms()} — has workspaces: ${hasWorkspaces}`);
            router.replace(hasWorkspaces ? '/(tabs)/workspaces' : '/(tabs)/workspaces?action=new');
          } catch {
            router.replace('/(tabs)/workspaces');
          }
          return;
        }
        console.log(`[AUTH] ${ms()} — no user, trying silent sign-in...`);
        const t2 = Date.now();
        const silent = await trySilentSignIn();
        console.log(`[AUTH] ${Date.now() - t2}ms — trySilentSignIn: ${silent ? silent.email : 'null'}`);
        if (silent) {
          const { switchUser } = await import('@/lib/db');
          await switchUser(silent.id);
          setUserId(silent.id);
          try {
            const res = await fetch(`${process.env.EXPO_PUBLIC_TARFLUE_URL || 'https://taragent.tar-54d.workers.dev'}/workspaces`, {
              headers: { 'X-User-Id': silent.id },
            });
            const data = await res.json();
            const hasWorkspaces = (data.workspaces || []).length > 0;
            router.replace(hasWorkspaces ? '/(tabs)/workspaces' : '/(tabs)/workspaces?action=new');
          } catch {
            router.replace('/(tabs)/workspaces');
          }
        } else {
          console.log(`[AUTH] ${ms()} — no silent sign-in, staying on auth screen`);
        }
      } catch (_e) {
        console.log(`[AUTH] ${ms()} — catch:`, _e);
      }
    })();
  }, [router]);

  const handleGoogleAuth = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      const { switchUser } = await import('@/lib/db');
      await switchUser(user.id);
      setUserId(user.id);
      try {
        const res = await fetch(`${process.env.EXPO_PUBLIC_TARFLUE_URL || 'https://taragent.tar-54d.workers.dev'}/workspaces`, {
          headers: { 'X-User-Id': user.id },
        });
        const data = await res.json();
        const hasWorkspaces = (data.workspaces || []).length > 0;
        router.replace(hasWorkspaces ? '/(tabs)/workspaces' : '/(tabs)/workspaces?action=new');
      } catch {
        router.replace('/(tabs)/workspaces');
      }
    } catch (e: any) {
      console.warn('[Auth] Google sign-in failed:', e.message);
      Alert.alert('Google Sign-In Error', e.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#1E5631' }]}>
      <StatusBar style="light" />
      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
        <View style={styles.logoContainer}>
          <TarLogo size={logoHeight} color="#EBA827" />
        </View>
        <Text style={[styles.title, { color: '#FFFFFF' }]}>tar.</Text>
        <Text style={[styles.subtitle, { color: '#E2F1E8' }]}>Everything app</Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.solutions}>
          {SOLUTIONS.map((item) => (
            <View key={item.label} style={styles.solutionRow}>
              <Ionicons name={item.icon} size={22} color="#E2F1E8" />
              <Text style={[styles.solutionLabel, { color: '#E2F1E8' }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />

        <Pressable
          style={[styles.authButton, { backgroundColor: '#FFFFFF' }]}
          onPress={handleGoogleAuth}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#1E5631" />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#1E5631" />
              <Text style={[styles.authButtonText, { color: '#1E5631' }]}>Continue with Google</Text>
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
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
    marginBottom: 12,
  },
  title: { fontSize: 64, fontWeight: '800', letterSpacing: -2 },
  subtitle: { fontSize: 28, fontWeight: '700', marginTop: 4 },
  bottom: { paddingHorizontal: 32 },
  solutions: { gap: 16 },
  solutionRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  solutionLabel: { fontSize: 20, fontWeight: '500' },
  authButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, gap: 12, marginBottom: 48 },
  authButtonText: { fontSize: 16, fontWeight: '600' },
});
