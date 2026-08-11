import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { TarLogo } from '@/components/TarLogo';
import { TarLogoLoader } from '@/components/TarLogoLoader';
import { tar } from '@/lib/tar';
import { generateSiteLayout } from '@/lib/site-ai';
import * as SecureStore from 'expo-secure-store';

const STARTER_PILLS = [
  { label: 'Cafe & Bakery', name: 'Velvet Brew', prompt: 'Specialty coffee shop and bakery with table orders' },
  { label: 'Retail Store', name: 'Kicks Vault', prompt: 'Streetwear sneakers boutique with stock inventory' },
  { label: 'Salon & Spa', name: 'Glow Studio', prompt: 'Beauty salon with appointment scheduling catalog' },
  { label: 'Tech Startup', name: 'CloudPulse', prompt: 'SaaS tech product landing page with subscription plans' },
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

  const [promptInput, setPromptInput] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSynthesizing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSynthesizing, pulseAnim]);

  // Subdomain slug calculation
  const rawText = promptInput.trim();
  const rawWords = rawText.split(/\s+/).filter(Boolean);
  const extractedName = rawWords.slice(0, 3).join(' ') || 'Workspace';

  let baseSlug = extractedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'workspace';

  let resolvedSlug = baseSlug;
  if (existingSubdomains.includes(resolvedSlug)) {
    let counter = 2;
    while (existingSubdomains.includes(`${baseSlug}-${counter}`)) {
      counter++;
    }
    resolvedSlug = `${baseSlug}-${counter}`;
  }

  const detectVertical = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('coffee') || lower.includes('cafe') || lower.includes('bakery') || lower.includes('restaurant') || lower.includes('food')) {
      return 'restaurant';
    }
    if (lower.includes('store') || lower.includes('shop') || lower.includes('retail') || lower.includes('sneaker') || lower.includes('apparel')) {
      return 'retail';
    }
    if (lower.includes('salon') || lower.includes('spa') || lower.includes('beauty') || lower.includes('hair') || lower.includes('clinic')) {
      return 'salon';
    }
    if (lower.includes('saas') || lower.includes('tech') || lower.includes('app') || lower.includes('software') || lower.includes('cloud')) {
      return 'tech';
    }
    return 'business';
  };

  const handleSelectPill = (pill: typeof STARTER_PILLS[0]) => {
    setPromptInput(pill.prompt);
  };

  const handleCreate = async () => {
    if (isSynthesizing || !promptInput.trim()) return;

    const finalName = extractedName.charAt(0).toUpperCase() + extractedName.slice(1);
    const vertical = detectVertical(promptInput);

    setIsSynthesizing(true);
    setErrorMessage(null);
    setCurrentStep(1);

    try {
      await new Promise((res) => setTimeout(res, 400));
      setCurrentStep(2);

      let finalSlug = resolvedSlug;
      try {
        await tar.createWorkspace({
          name: finalName,
          subdomain: finalSlug,
          description: promptInput.trim(),
          type: vertical,
        });
      } catch (createErr: any) {
        if (createErr?.message?.includes('already exists') || createErr?.message?.includes('duplicate')) {
          finalSlug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
          await tar.createWorkspace({
            name: finalName,
            subdomain: finalSlug,
            description: promptInput.trim(),
            type: vertical,
          });
        } else {
          throw createErr;
        }
      }

      await SecureStore.setItemAsync('active_workspace_subdomain', finalSlug).catch(() => null);

      setCurrentStep(3);
      try {
        const starterLayout = await generateSiteLayout(
          finalName,
          [],
          promptInput.trim(),
          null,
          vertical
        );
        await tar.okf.upload(`t:${finalSlug}`, 'site/draft.json', JSON.stringify(starterLayout));
        await tar.okf.upload(`t:${finalSlug}`, 'site/published.json', JSON.stringify(starterLayout));
      } catch (siteErr) {
        console.warn('[CreateWorkspace] Starter layout deferred:', siteErr);
      }

      setCurrentStep(4);
      await new Promise((res) => setTimeout(res, 300));

      setPromptInput('');
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
    'Building workspace...',
    'Setting up database...',
    'Generating layout...',
    'Launching...',
  ];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="pageSheet"
      statusBarTranslucent
      onRequestClose={() => { if (canClose && !isSynthesizing) onClose(); }}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          {/* Header Bar: Only close button with light border */}
          <View style={[styles.headerBar, { paddingTop: Math.max(insets.top + 8, 16) }]}>
            <View style={{ flex: 1 }} />
            {canClose && !isSynthesizing && (
              <Pressable onPress={onClose} style={[styles.closeBtn, { borderColor: theme.border }]} hitSlop={8}>
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>

          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 20, 32) }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Left-Aligned AI Chat Header */}
            <View style={styles.chatHeaderSection}>
              <Animated.View style={[styles.avatarCircle, { transform: [{ scale: pulseAnim }] }]}>
                <TarLogo size={44} color="#007AFF" />
              </Animated.View>
              <Text style={[styles.questionText, { color: theme.text }]}>
                What would you like to build?
              </Text>
              <View style={[styles.urlBadge, { borderColor: theme.border }]}>
                <Text style={[styles.urlText, { color: theme.textMuted }]}>
                  <Text style={{ color: '#007AFF', fontWeight: '700' }}>{resolvedSlug}</Text>.tarai.space
                </Text>
              </View>
            </View>

            {/* Error Banner */}
            {errorMessage && (
              <View style={[styles.errorCard, { borderColor: '#ef444460' }]}>
                <Text style={[styles.errorText, { color: '#ef4444' }]}>{errorMessage}</Text>
              </View>
            )}

            {isSynthesizing ? (
              /* Building View with light border */
              <View style={[styles.buildingCard, { borderColor: theme.border }]}>
                <TarLogoLoader size={36} color="#007AFF" style={{ marginBottom: 12 }} />
                <Text style={[styles.buildingStatus, { color: theme.text }]}>
                  {stepLabels[Math.min(currentStep - 1, stepLabels.length - 1)] || 'Initializing...'}
                </Text>
                <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: '#007AFF',
                        width: `${(currentStep / stepLabels.length) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ) : (
              /* Input & Chips with soft light borders and no grey background */
              <View style={styles.inputSection}>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={promptInput}
                  onChangeText={setPromptInput}
                  placeholder="Describe your vision..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={4}
                  autoFocus
                />

                {/* Horizontal Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
                  {STARTER_PILLS.map((pill, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => handleSelectPill(pill)}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          borderColor: theme.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: theme.text }]}>{pill.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Primary Action Button */}
                <Pressable
                  onPress={handleCreate}
                  disabled={!promptInput.trim()}
                  style={({ pressed }) => [
                    styles.submitButton,
                    {
                      backgroundColor: promptInput.trim() ? '#007AFF' : theme.background,
                      borderColor: promptInput.trim() ? '#007AFF' : theme.border,
                      opacity: pressed ? 0.8 : promptInput.trim() ? 1 : 0.5,
                    },
                  ]}
                >
                  <Text style={[styles.submitButtonText, { color: promptInput.trim() ? '#FFFFFF' : theme.textMuted }]}>
                    Build Workspace
                  </Text>
                </Pressable>
              </View>
            )}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  chatHeaderSection: {
    alignItems: 'flex-start',
    marginVertical: 20,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0F6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  questionText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 10,
    textAlign: 'left',
  },
  urlBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  urlText: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  inputSection: {
    marginTop: 16,
    gap: 16,
  },
  textInput: {
    minHeight: 100,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  pillsRow: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  buildingCard: {
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  buildingStatus: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});

