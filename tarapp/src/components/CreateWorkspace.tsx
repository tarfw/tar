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
import { tar } from '@/lib/tar';
import { generateSiteLayout } from '@/lib/site-ai';
import * as SecureStore from 'expo-secure-store';

const BUSINESS_VERTICALS = [
  { id: 'business', label: 'General', icon: 'briefcase-outline' },
  { id: 'retail', label: 'Retail & Store', icon: 'cart-outline' },
  { id: 'restaurant', label: 'Restaurant & Cafe', icon: 'restaurant-outline' },
  { id: 'salon', label: 'Salon & Spa', icon: 'cut-outline' },
  { id: 'clinic', label: 'Healthcare', icon: 'medical-outline' },
  { id: 'logistics', label: 'Logistics', icon: 'car-outline' },
  { id: 'tech', label: 'Tech & SaaS', icon: 'hardware-chip-outline' },
];

const PRESET_IDEAS = [
  { label: '☕ Cafe & Bakery', name: 'Velvet Brew', prompt: 'Specialty coffee shop and bakery with menu items and table orders' },
  { label: '🛍️ Retail Store', name: 'Kicks Vault', prompt: 'High-end sneakers and streetwear store with inventory tracking' },
  { label: '✂️ Salon & Spa', name: 'Glow Studio', prompt: 'Beauty salon with appointment scheduling and service catalog' },
  { label: '🚀 Tech Startup', name: 'CloudPulse', prompt: 'SaaS tech product landing page with subscription pricing' },
];

interface CreateWorkspaceProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (subdomain: string) => Promise<void>;
  canClose: boolean;
}

export default function CreateWorkspace({
  visible,
  onClose,
  onSuccess,
  canClose,
}: CreateWorkspaceProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [workspaceName, setWorkspaceName] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [selectedVertical, setSelectedVertical] = useState('business');
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Exact TarLogo color matched to Auth Screen
  const logoBrandColor = theme.dark ? '#a78bfa' : '#392878';

  // Pulse animation for TAR Logo
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSynthesizing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
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

  // Clean subdomain slug calculation
  const derivedSlug = (workspaceName.trim() || promptInput.trim().split(' ').slice(0, 2).join(' ') || 'workspace')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30) || 'ws-app';

  const handleSelectPreset = (preset: typeof PRESET_IDEAS[0]) => {
    setWorkspaceName(preset.name);
    setPromptInput(preset.prompt);
  };

  const handleCreate = async () => {
    if (isSynthesizing) return;
    const finalName = workspaceName.trim() || promptInput.trim().slice(0, 24) || 'New Workspace';
    const finalSlug = finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || `ws-${Date.now().toString(36)}`;

    setIsSynthesizing(true);
    setErrorMessage(null);
    setCurrentStep(1);

    try {
      await new Promise((res) => setTimeout(res, 500));
      setCurrentStep(2);

      await tar.createWorkspace({
        name: finalName,
        subdomain: finalSlug,
        description: promptInput.trim() || `${finalName} workspace`,
        type: selectedVertical,
      });
      await SecureStore.setItemAsync('active_workspace_subdomain', finalSlug).catch(() => null);

      setCurrentStep(3);
      try {
        const starterLayout = await generateSiteLayout(
          finalName,
          [],
          promptInput.trim() || `Create a starter site for ${finalName} (${selectedVertical})`,
          null,
          selectedVertical
        );
        await tar.okf.write(`t:${finalSlug}`, 'site/draft.json', JSON.stringify(starterLayout));
        await tar.okf.write(`t:${finalSlug}`, 'site/published.json', JSON.stringify(starterLayout));
      } catch (siteErr) {
        console.warn('[AgenticCreate] Starter site skipped:', siteErr);
      }

      setCurrentStep(4);
      await new Promise((res) => setTimeout(res, 400));

      setWorkspaceName('');
      setPromptInput('');
      setIsSynthesizing(false);
      setCurrentStep(0);
      await onSuccess(finalSlug);
    } catch (err: any) {
      console.error('[AgenticCreate] Error creating workspace:', err);
      setErrorMessage(err?.message || 'Failed to create workspace. Please try again.');
      setIsSynthesizing(false);
      setCurrentStep(0);
    }
  };

  const stepLabels = [
    'Synthesizing architecture...',
    'Provisioning database & scope...',
    'Generating starter site...',
    'Launching workspace...',
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => { if (canClose && !isSynthesizing) onClose(); }}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          {/* Header Bar */}
          <View style={[styles.headerBar, { paddingTop: Math.max(insets.top + 8, 16) }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>New Workspace</Text>
            {canClose && !isSynthesizing && (
              <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.backgroundElement }]} hitSlop={8}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* Main Uncluttered Scroll Container */}
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* TarLogo Hero Avatar (Identical design language to Auth screen) */}
            <View style={styles.heroSection}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 14 }}>
                <TarLogo size={76} color={logoBrandColor} />
              </Animated.View>
              <Text style={[styles.heroTitle, { color: theme.text }]}>
                {isSynthesizing ? 'Setting Up Workspace' : 'Create Workspace'}
              </Text>
              <Text style={[styles.heroSub, { color: theme.textMuted }]}>
                {derivedSlug}.tarai.space
              </Text>
            </View>

            {/* Error Message */}
            {errorMessage && (
              <View style={[styles.errorCard, { backgroundColor: '#ef444415', borderColor: '#ef444440' }]}>
                <Ionicons name="alert-circle-outline" size={18} color="#ef4444" />
                <Text style={[styles.errorText, { color: '#ef4444' }]}>{errorMessage}</Text>
              </View>
            )}

            {isSynthesizing ? (
              /* Clean Minimal Progress View */
              <View style={[styles.progressBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <ActivityIndicator size="large" color={theme.primary} style={{ marginBottom: 14 }} />
                <Text style={[styles.progressStatus, { color: theme.text }]}>
                  {stepLabels[Math.min(currentStep - 1, stepLabels.length - 1)] || 'Initializing...'}
                </Text>
                <View style={[styles.progressBarTrack, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: theme.primary,
                        width: `${(currentStep / stepLabels.length) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ) : (
              /* Clean Uncluttered Form */
              <View style={styles.formContent}>
                {/* Workspace Name */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Workspace Name</Text>
                  <TextInput
                    style={[
                      styles.nameInput,
                      {
                        color: theme.text,
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.border,
                      },
                    ]}
                    value={workspaceName}
                    onChangeText={setWorkspaceName}
                    placeholder="Workspace Name (e.g. Storea, Velvet Brew)"
                    placeholderTextColor={theme.textMuted}
                    autoFocus
                  />
                </View>

                {/* Vertical Category Selection Chips */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Business Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {BUSINESS_VERTICALS.map((vert) => {
                      const selected = selectedVertical === vert.id;
                      return (
                        <Pressable
                          key={vert.id}
                          onPress={() => setSelectedVertical(vert.id)}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: selected ? theme.primary + '18' : theme.backgroundElement,
                              borderColor: selected ? theme.primary : theme.border,
                            },
                          ]}
                        >
                          <Ionicons
                            name={vert.icon as any}
                            size={15}
                            color={selected ? theme.primary : theme.textSecondary}
                          />
                          <Text
                            style={[
                              styles.chipText,
                              { color: selected ? theme.primary : theme.textSecondary, fontWeight: selected ? '600' : '400' },
                            ]}
                          >
                            {vert.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Optional AI Prompt Collapsible Box */}
                {!showPromptInput ? (
                  <Pressable
                    onPress={() => setShowPromptInput(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}
                  >
                    <Ionicons name="sparkles-outline" size={15} color={theme.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.primary }}>+ Add AI Prompt Vision (Optional)</Text>
                  </Pressable>
                ) : (
                  <View style={styles.inputGroup}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>AI Vision & Prompt</Text>
                      <Pressable onPress={() => setShowPromptInput(false)}>
                        <Ionicons name="close-circle-outline" size={16} color={theme.textMuted} />
                      </Pressable>
                    </View>
                    <TextInput
                      style={[
                        styles.promptInput,
                        {
                          color: theme.text,
                          backgroundColor: theme.backgroundElement,
                          borderColor: theme.border,
                        },
                      ]}
                      value={promptInput}
                      onChangeText={setPromptInput}
                      placeholder="Describe what your workspace does..."
                      placeholderTextColor={theme.textMuted}
                      multiline
                      numberOfLines={2}
                    />
                  </View>
                )}

                {/* Quick Presets */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Quick Starter Ideas</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {PRESET_IDEAS.map((preset, idx) => (
                      <Pressable
                        key={idx}
                        onPress={() => handleSelectPreset(preset)}
                        style={[styles.presetChip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
                      >
                        <Text style={[styles.presetText, { color: theme.text }]}>{preset.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Create CTA Button */}
                <Pressable
                  onPress={handleCreate}
                  disabled={!workspaceName.trim() && !promptInput.trim()}
                  style={({ pressed }) => [
                    styles.createButton,
                    {
                      backgroundColor: (workspaceName.trim() || promptInput.trim()) ? theme.primary : theme.border,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <TarLogo size={20} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={[styles.createButtonText, { color: (workspaceName.trim() || promptInput.trim()) ? '#ffffff' : theme.textMuted }]}>
                    Create Workspace
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  formContent: {
    gap: 18,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  promptInput: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  createButton: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  progressStatus: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 16,
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
