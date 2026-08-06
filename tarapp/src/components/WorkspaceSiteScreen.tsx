import React, { useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useSite } from '@/hooks/use-site';
import { generateSiteLayout } from '@/lib/site-ai';
import { sectionSummary, Section } from '@/lib/site-schema';

const DESIGN_PRESETS = [
  { id: 'notion', label: 'Notion', prompt: 'Use notion design and create a saas workspace page' },
  { id: 'lululemon', label: 'Lululemon', prompt: 'Use lululemon design and create activewear store' },
  { id: 'pouch', label: 'Drink Pouch', prompt: 'Use drinkpouch design and create formula store' },
  { id: 'tech', label: 'Minimal Tech', prompt: 'Minimalist tech product landing page' },
  { id: 'luxury', label: 'Luxury Dark', prompt: 'Luxury fashion boutique with dark aesthetic' },
  { id: 'cafe', label: 'Artisan Cafe', prompt: 'Modern cafe & bakery with menu and hours' },
];

interface WorkspaceSiteScreenProps {
  visible: boolean;
  onClose: () => void;
  workspaceName: string;
  subdomain: string;
  scope: string;
  products?: any[];
}

export default function WorkspaceSiteScreen({
  visible,
  onClose,
  workspaceName,
  subdomain,
  scope,
  products = [],
}: WorkspaceSiteScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const effectiveStoreId = scope || subdomain || 'default';
  const { draft, published, loading, saveDraft, publish } = useSite(effectiveStoreId);

  const [instruction, setInstruction] = useState('');
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const cleanSub = (subdomain || 'site').replace(/^w:/, '');
  const siteUrl = `https://${cleanSub}.tarai.space`;

  const handleOpenLiveSite = () => {
    Linking.openURL(siteUrl);
  };

  const handleGenerate = async (promptText?: string, templateHint?: string) => {
    const text = (promptText || instruction).trim();
    if (!text || generating) return;
    setGenerating(true);
    setFeedback(null);

    try {
      const productList = products.map((p) => ({
        name: p.title || p.name || 'Item',
        price: p.value || p.price || null,
        description: p.data?.description || '',
      }));

      const newLayout = await generateSiteLayout(workspaceName || cleanSub, productList, text, draft, templateHint);
      await saveDraft(newLayout);
      setInstruction('');
      setFeedback({ text: 'Layout generated & saved. Tap Publish to go live.', type: 'success' });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Failed to generate layout.', type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (publishing) return;
    setPublishing(true);
    setFeedback(null);
    try {
      await publish(cleanSub);
      setFeedback({ text: `Published live to ${siteUrl}`, type: 'success' });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Failed to publish site.', type: 'error' });
    } finally {
      setPublishing(false);
    }
  };

  const isDirty = !published || JSON.stringify(draft) !== JSON.stringify(published);
  const activeSections: Section[] = (draft as any)?.sections || [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          {/* Minimal Header */}
          <View style={[styles.header, { borderBottomColor: theme.border + '40', paddingTop: Math.max(insets.top, 14) }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: theme.text }]}>{workspaceName || 'Storefront'}</Text>
                <View style={[styles.dot, { backgroundColor: isDirty ? '#f59e0b' : '#10b981' }]} />
              </View>
              <Text style={[styles.subdomain, { color: theme.textMuted }]}>{cleanSub}.tarai.space</Text>
            </View>

            <View style={styles.headerRight}>
              <Pressable onPress={handleOpenLiveSite} style={styles.iconBtn} hitSlop={8}>
                <Ionicons name="open-outline" size={17} color={theme.primary} />
              </Pressable>
              <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>
          </View>

          {/* Toast / Feedback Banner */}
          {feedback && (
            <View
              style={[
                styles.feedback,
                { backgroundColor: feedback.type === 'success' ? '#10b98115' : '#ef444415' },
              ]}
            >
              <Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#10b981' : '#ef4444' }]}>
                {feedback.text}
              </Text>
            </View>
          )}

          {/* Main Scroll Content */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
              {/* Minimal Preset Pills */}
              <View style={styles.presetSection}>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>PRESETS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsRow}>
                  {DESIGN_PRESETS.map((preset) => (
                    <Pressable
                      key={preset.id}
                      style={({ pressed }) => [
                        styles.presetChip,
                        {
                          backgroundColor: theme.backgroundElement,
                          borderColor: theme.border + '60',
                          opacity: pressed || generating ? 0.6 : 1,
                        },
                      ]}
                      disabled={generating}
                      onPress={() => handleGenerate(preset.prompt, preset.id)}
                    >
                      <Text style={[styles.presetChipText, { color: theme.text }]}>{preset.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Active Layout List */}
              <View style={styles.sectionsContainer}>
                <View style={styles.sectionsHeader}>
                  <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                    ACTIVE LAYOUT ({activeSections.length})
                  </Text>
                  {draft?.theme?.font && (
                    <Text style={[styles.metaText, { color: theme.textMuted }]}>
                      Font: {draft.theme.font}
                    </Text>
                  )}
                </View>

                {activeSections.length > 0 ? (
                  activeSections.map((section, idx) => {
                    const typeLabel = section.type.replace(/_/g, ' ');
                    const summary = sectionSummary(section);

                    return (
                      <View key={idx} style={[styles.sectionRow, { borderBottomColor: theme.border + '30' }]}>
                        <View style={[styles.typeDot, { backgroundColor: theme.primary }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.sectionType, { color: theme.text }]}>{typeLabel}</Text>
                          <Text style={[styles.sectionSummary, { color: theme.textMuted }]} numberOfLines={1}>
                            {summary}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    No custom sections. Choose a preset above or enter a prompt.
                  </Text>
                )}
              </View>
            </ScrollView>
          )}

          {/* Minimal Bottom Action Dock */}
          <View
            style={[
              styles.bottomDock,
              { borderTopColor: theme.border + '40', backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            {/* Publish Button */}
            <Pressable
              style={({ pressed }) => [
                styles.publishBtn,
                {
                  backgroundColor: isDirty ? theme.primary : '#10b981',
                  opacity: publishing || pressed ? 0.7 : 1,
                },
              ]}
              disabled={publishing}
              onPress={handlePublish}
            >
              {publishing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.publishText}>
                  {isDirty ? 'Publish Site to Live' : 'Published & Up to Date'}
                </Text>
              )}
            </Pressable>

            {/* AI Prompt Input Bar */}
            <View style={[styles.inputBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border + '60' }]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={instruction}
                onChangeText={setInstruction}
                placeholder={draft ? 'Describe layout changes...' : 'Describe storefront...'}
                placeholderTextColor={theme.textMuted}
                editable={!generating}
                onSubmitEditing={() => handleGenerate()}
                returnKeyType="send"
              />
              {generating ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ paddingHorizontal: 4 }} />
              ) : (
                <Pressable
                  onPress={() => handleGenerate()}
                  disabled={!instruction.trim()}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={26}
                    color={instruction.trim() ? theme.primary : theme.textMuted + '60'}
                  />
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subdomain: {
    fontSize: 12,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    padding: 4,
  },
  feedback: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '500',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 20,
  },
  presetSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  presetsRow: {
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionsContainer: {
    gap: 10,
  },
  sectionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 11,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  typeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  sectionType: {
    fontSize: 13.5,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  sectionSummary: {
    fontSize: 11.5,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 12,
    paddingVertical: 12,
  },
  bottomDock: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  publishBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
  },
  publishText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 4,
  },
});



