import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { TarLogoLoader } from '@/components/TarLogoLoader';
import { tar } from '@/lib/tar';
import * as SecureStore from 'expo-secure-store';

// ── 1. Business Categories ───────────────────────────────────────────
const BUSINESS_CATEGORIES = [
  { id: 'cafe', label: 'Cafe & Bakery', icon: 'cafe-outline', defaultTheme: 'milo', starterName: 'Velvet Brew' },
  { id: 'retail', label: 'Fashion & Retail', icon: 'shirt-outline', defaultTheme: 'kith', starterName: 'Kicks Vault' },
  { id: 'salon', label: 'Salon & Spa', icon: 'sparkles-outline', defaultTheme: 'milo', starterName: 'Glow Studio' },
  { id: 'tech', label: 'Tech & SaaS', icon: 'cube-outline', defaultTheme: 'planhat', starterName: 'CloudPulse' },
  { id: 'travel', label: 'Hotel & Travel', icon: 'bed-outline', defaultTheme: 'joandso', starterName: 'Casa Sol' },
  { id: 'music', label: 'Music & Creative', icon: 'musical-notes-outline', defaultTheme: 'empire', starterName: 'Sonic Lab' },
];

// ── 2. Visual Theme Cards (Powered by R2 Themes) ────────────────────
const THEME_PRESETS = [
  {
    id: 'planhat',
    name: 'Planhat Tech',
    vibe: 'Cinematic Monochrome · Obsidian & Ember',
    tag: 'SaaS & Enterprise',
    bg: '#000000',
    accent: '#E8552B',
  },
  {
    id: 'milo',
    name: 'Milo Fresh',
    vibe: 'Clean Botanical · Earthy Green & Cream',
    tag: 'Wellness & Cafe',
    bg: '#032E1C',
    accent: '#1FCB60',
  },
  {
    id: 'kith',
    name: 'Kith Modern',
    vibe: 'Luxury Monochrome · Sharp Boxy Streetwear',
    tag: 'Streetwear & Retail',
    bg: '#111111',
    accent: '#FFFFFF',
  },
  {
    id: 'eql',
    name: 'EQL Launch',
    vibe: 'High-Heat Drops · Bold Yellow Badges',
    tag: 'Limited Releases',
    bg: '#FFE600',
    accent: '#0A0A0C',
  },
  {
    id: 'joandso',
    name: 'JO & SO',
    vibe: 'Warm Editorial · Warm Taupe & Sand',
    tag: 'Boutique & Hotel',
    bg: '#F5F2EB',
    accent: '#2C2A29',
  },
  {
    id: 'empire',
    name: 'EMPIRE Dark',
    vibe: 'Deep Obsidian · Modern Creative Label',
    tag: 'Music & Creators',
    bg: '#0A0A0C',
    accent: '#E5E7EB',
  },
];

interface CreateWorkspaceProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (subdomain: string) => Promise<void>;
  canClose: boolean;
  existingSubdomains?: string[];
}

export default function CreateWorkspace({
  visible,
  onClose,
  onSuccess,
  canClose,
  existingSubdomains = [],
}: CreateWorkspaceProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedCategory, setSelectedCategory] = useState(BUSINESS_CATEGORIES[0]);
  const [selectedTheme, setSelectedTheme] = useState(THEME_PRESETS[1]);
  const [storeName, setStoreName] = useState(BUSINESS_CATEGORIES[0].starterName);

  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Subdomain Calculation
  const rawName = storeName.trim() || 'store';
  let baseSlug = rawName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'store';

  let resolvedSlug = baseSlug;
  if (existingSubdomains.includes(resolvedSlug)) {
    let counter = 2;
    while (existingSubdomains.includes(`${baseSlug}-${counter}`)) {
      counter++;
    }
    resolvedSlug = `${baseSlug}-${counter}`;
  }

  const handleSelectCategory = (cat: typeof BUSINESS_CATEGORIES[0]) => {
    setSelectedCategory(cat);
    setStoreName(cat.starterName);
    const matchingTheme = THEME_PRESETS.find((t) => t.id === cat.defaultTheme) || THEME_PRESETS[0];
    setSelectedTheme(matchingTheme);
  };

  const handleLaunch = async () => {
    if (isSynthesizing || !storeName.trim()) return;

    const finalName = storeName.trim();
    setIsSynthesizing(true);
    setErrorMessage(null);
    setCurrentStep(1);

    try {
      await new Promise((res) => setTimeout(res, 200));
      setCurrentStep(2);

      let finalSlug = resolvedSlug;
      try {
        await tar.createWorkspace({
          name: finalName,
          subdomain: finalSlug,
          description: `${selectedCategory.label} powered by ${selectedTheme.name}`,
          type: selectedCategory.id,
        });
      } catch (createErr: any) {
        if (createErr?.message?.includes('already exists') || createErr?.message?.includes('duplicate')) {
          finalSlug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
          await tar.createWorkspace({
            name: finalName,
            subdomain: finalSlug,
            description: `${selectedCategory.label} powered by ${selectedTheme.name}`,
            type: selectedCategory.id,
          });
        } else {
          throw createErr;
        }
      }

      await SecureStore.setItemAsync('active_workspace_subdomain', finalSlug).catch(() => null);

      setCurrentStep(3);

      // Instant 1-Click Edge Publish (< 50ms)
      try {
        await fetch(`https://${finalSlug}.tarai.space/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subdomain: finalSlug,
            workspaceName: finalName,
            template: selectedTheme.id,
          }),
        }).catch((e) => console.warn('[CreateWorkspace] Edge publish note:', e));
      } catch (siteErr) {
        console.warn('[CreateWorkspace] Edge publish fallback deferred:', siteErr);
      }

      setCurrentStep(4);
      await new Promise((res) => setTimeout(res, 200));

      setIsSynthesizing(false);
      setCurrentStep(0);
      await onSuccess(finalSlug);
    } catch (err: any) {
      console.error('[CreateWorkspace] Creation error:', err);
      setErrorMessage(err?.message || 'Failed to create workspace. Please try again.');
      setIsSynthesizing(false);
      setCurrentStep(0);
    }
  };

  const stepLabels = [
    'Setting up workspace...',
    'Initializing database...',
    'Publishing live storefront...',
    'Ready!',
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent
      onRequestClose={() => {
        if (canClose && !isSynthesizing) onClose();
      }}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {/* Header Bar */}
          <View style={[styles.headerBar, { paddingTop: Math.max(insets.top + 6, 14) }]}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>New Storefront</Text>
              <Text style={[styles.headerSub, { color: theme.textMuted }]}>3-step instant launchpad</Text>
            </View>
            {canClose && !isSynthesizing && (
              <Pressable onPress={onClose} style={[styles.closeBtn, { borderColor: theme.border + '60' }]} hitSlop={8}>
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>

          {isSynthesizing ? (
            /* Loader State */
            <View style={styles.loaderContainer}>
              <TarLogoLoader size={40} color="#007AFF" style={{ marginBottom: 16 }} />
              <Text style={[styles.loaderStatus, { color: theme.text }]}>
                {stepLabels[Math.min(currentStep - 1, stepLabels.length - 1)] || 'Launching...'}
              </Text>
              <Text style={[styles.loaderSub, { color: theme.textMuted }]}>
                {resolvedSlug}.tarai.space
              </Text>
            </View>
          ) : (
            /* Clean Compact Form */
            <ScrollView
              contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {errorMessage && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* STEP 1: BUSINESS TYPE */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>1. BUSINESS TYPE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowList}>
                  {BUSINESS_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory.id === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => handleSelectCategory(cat)}
                        style={[
                          styles.catPill,
                          {
                            backgroundColor: isSelected ? '#007AFF15' : theme.backgroundElement,
                            borderColor: isSelected ? '#007AFF' : theme.border + '50',
                          },
                        ]}
                      >
                        <Ionicons
                          name={cat.icon as any}
                          size={15}
                          color={isSelected ? '#007AFF' : theme.textSecondary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.catText, { color: isSelected ? '#007AFF' : theme.text }]}>
                          {cat.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* STEP 2: DESIGN THEME */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>2. DESIGN THEME</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowList}>
                  {THEME_PRESETS.map((t) => {
                    const isSelected = selectedTheme.id === t.id;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => setSelectedTheme(t)}
                        style={[
                          styles.themeCard,
                          {
                            borderColor: isSelected ? '#007AFF' : theme.border + '50',
                            borderWidth: isSelected ? 2 : 1,
                            backgroundColor: theme.backgroundElement,
                          },
                        ]}
                      >
                        <View style={[styles.themeBanner, { backgroundColor: t.bg }]}>
                          <View style={[styles.themeDot, { backgroundColor: t.accent }]} />
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={16} color="#007AFF" style={styles.cardCheck} />
                          )}
                        </View>
                        <View style={styles.themeBody}>
                          <Text style={[styles.themeTitle, { color: theme.text }]}>{t.name}</Text>
                          <Text style={[styles.themeDesc, { color: theme.textMuted }]} numberOfLines={1}>
                            {t.vibe}
                          </Text>
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{t.tag}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* STEP 3: STORE NAME & SUBDOMAIN */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>3. STORE NAME & DOMAIN</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.backgroundElement, borderColor: theme.border + '60' }]}>
                  <Ionicons name="storefront-outline" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.inputField, { color: theme.text }]}
                    value={storeName}
                    onChangeText={setStoreName}
                    placeholder="Store Name"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>

                <View style={[styles.urlBadge, { backgroundColor: '#007AFF0D', borderColor: '#007AFF25' }]}>
                  <Ionicons name="globe-outline" size={13} color="#007AFF" style={{ marginRight: 5 }} />
                  <Text style={[styles.urlLabel, { color: theme.textMuted }]}>
                    Live at: <Text style={{ color: '#007AFF', fontWeight: '700' }}>{resolvedSlug}</Text>.tarai.space
                  </Text>
                </View>
              </View>

              {/* Launch Button */}
              <Pressable
                onPress={handleLaunch}
                style={({ pressed }) => [
                  styles.launchBtn,
                  {
                    backgroundColor: '#007AFF',
                    opacity: pressed || !storeName.trim() ? 0.8 : 1,
                  },
                ]}
                disabled={!storeName.trim()}
              >
                <Ionicons name="rocket-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.launchBtnText}>Launch Storefront Live</Text>
              </Pressable>
            </ScrollView>
          )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.02,
  },
  headerSub: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 16,
  },
  sectionBlock: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.06,
    textTransform: 'uppercase',
  },
  rowList: {
    gap: 8,
    paddingVertical: 2,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  catText: {
    fontSize: 12,
    fontWeight: '600',
  },
  themeCard: {
    width: 155,
    borderRadius: 12,
    overflow: 'hidden',
  },
  themeBanner: {
    height: 32,
    width: '100%',
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardCheck: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  themeBody: {
    padding: 8,
    gap: 2,
  },
  themeTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  themeDesc: {
    fontSize: 10,
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  urlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 2,
  },
  urlLabel: {
    fontSize: 11,
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 4,
  },
  launchBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loaderStatus: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  loaderSub: {
    fontSize: 13,
  },
  errorBanner: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#ef444415',
    borderWidth: 1,
    borderColor: '#ef444450',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
});
