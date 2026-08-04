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

const WorkspaceThumbnail = ({ name, size = 26, theme }: { name: string; size?: number; theme: any }) => {
  const initial = (name || 'W').charAt(0).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 3,
        backgroundColor: theme.primary + '18',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: theme.primary, fontWeight: '700', fontSize: size * 0.45 }}>
        {initial}
      </Text>
    </View>
  );
};

const STARTER_PROMPTS = [
  'Minimalist tech product landing page',
  'Luxury fashion boutique with dark aesthetic',
  'Modern cafe & bakery with menu and hours',
  'Professional agency with client testimonials',
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
  const { draft, published, loading, saveDraft, publish, refresh } = useSite(effectiveStoreId);

  const [instruction, setInstruction] = useState('');
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const cleanSub = (subdomain || 'site').replace(/^w:/, '');
  const siteUrl = `https://${cleanSub}.tarai.space`;
  const editorUrl = `https://${cleanSub}.tarai.space/edit`;

  const handleOpenLiveSite = () => {
    Linking.openURL(siteUrl);
  };

  const handleOpenEditor = () => {
    Linking.openURL(editorUrl);
  };

  const handleGenerate = async (promptText?: string) => {
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

      const newLayout = await generateSiteLayout(workspaceName || cleanSub, productList, text, draft);
      await saveDraft(newLayout);
      setInstruction('');
      setFeedback({ text: 'Site layout generated & saved! Tap Publish to take it live.', type: 'success' });
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
      setFeedback({ text: err?.message || 'Publishing failed.', type: 'error' });
    } finally {
      setPublishing(false);
    }
  };

  const isDirty = !published || (draft && JSON.stringify(draft) !== JSON.stringify(published));
  const activeSections: Section[] = draft?.sections || [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <WorkspaceThumbnail name={workspaceName || cleanSub} size={26} theme={theme} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
                {workspaceName || cleanSub}
              </Text>
              <Text style={[styles.headerSub, { color: theme.textMuted }]} numberOfLines={1}>
                {cleanSub}.tarai.space
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={handleOpenEditor} style={[styles.headerBtn, { backgroundColor: theme.border + '50' }]}>
              <Text style={[styles.headerBtnText, { color: theme.text }]}>Editor</Text>
            </Pressable>
            <Pressable onPress={handleOpenLiveSite} style={[styles.headerBtn, { backgroundColor: theme.primary + '16' }]}>
              <Text style={[styles.headerBtnText, { color: theme.primary, fontWeight: '600' }]}>View</Text>
            </Pressable>
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {feedback && (
            <View style={[styles.toast, { backgroundColor: feedback.type === 'success' ? '#10b98118' : '#ef444418' }]}>
              <Text style={[styles.toastText, { color: feedback.type === 'success' ? '#10b981' : '#ef4444' }]}>
                {feedback.text}
              </Text>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textMuted }]}>Loading storefront layout...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {generating && (
                <View style={[styles.generatingBanner, { backgroundColor: theme.primary + '12' }]}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[styles.generatingText, { color: theme.primary }]}>
                    Designing layout sections...
                  </Text>
                </View>
              )}

              {activeSections.length > 0 ? (
                <View style={styles.canvasContainer}>
                  <View style={styles.subheadRow}>
                    <Text style={[styles.subheadTitle, { color: theme.textMuted }]}>
                      LAYOUT SECTIONS ({activeSections.length})
                    </Text>
                    {draft?.theme && (
                      <Text style={[styles.themeText, { color: theme.textMuted }]}>
                        Font: {draft.theme.font || 'Inter'}
                      </Text>
                    )}
                  </View>

                  {activeSections.map((section, idx) => {
                    const typeLabel = section.type.replace(/_/g, ' ');
                    const summary = sectionSummary(section);
                    return (
                      <View
                        key={idx}
                        style={[styles.sectionRow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
                      >
                        <Text style={[styles.sectionIndexText, { color: theme.textMuted }]}>#{idx + 1}</Text>
                        <View style={styles.sectionInfo}>
                          <Text style={[styles.sectionName, { color: theme.text }]}>{typeLabel}</Text>
                          <Text style={[styles.sectionMeta, { color: theme.textMuted }]} numberOfLines={1}>
                            {summary}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>Design Storefront</Text>
                  <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                    Select a starter concept or describe your vision below.
                  </Text>

                  <View style={styles.starterPillsContainer}>
                    {STARTER_PROMPTS.map((promptText, i) => (
                      <Pressable
                        key={i}
                        style={({ pressed }) => [
                          styles.starterPill,
                          { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
                        ]}
                        disabled={generating}
                        onPress={() => handleGenerate(promptText)}
                      >
                        <Text style={[styles.starterPillText, { color: theme.text }]}>{promptText}</Text>
                        <Ionicons name="arrow-forward" size={13} color={theme.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* Fixed Bottom Bar */}
          <View style={[styles.bottomBar, { borderTopColor: theme.border, backgroundColor: theme.background, paddingBottom: insets.bottom + 6 }]}>
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
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.publishBtnText}>
                  {isDirty ? 'Publish Site to Live' : 'Published & Up to Date'}
                </Text>
              )}
            </Pressable>

            <View style={[styles.inputBarContainer, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={instruction}
                onChangeText={setInstruction}
                placeholder={draft ? 'Describe layout changes...' : 'Describe your storefront layout...'}
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
                    color={instruction.trim() ? theme.primary : theme.textMuted}
                  />
                </Pressable>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 4,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginLeft: 6,
  },
  headerTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 11,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  headerBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  toast: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 6,
  },
  toastText: {
    fontSize: 12,
    fontWeight: '500',
  },
  generatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  generatingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
  },
  canvasContainer: {
    gap: 6,
  },
  subheadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  subheadTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  themeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  sectionIndexText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionInfo: {
    flex: 1,
  },
  sectionName: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  sectionMeta: {
    fontSize: 11.5,
    marginTop: 2,
  },
  emptyStateContainer: {
    paddingVertical: 20,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 12,
  },
  starterPillsContainer: {
    gap: 8,
    marginTop: 14,
    width: '100%',
  },
  starterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  starterPillText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 6,
  },
  publishBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 8,
  },
  publishBtnText: {
    color: '#fff',
    fontSize: 13.5,
    fontWeight: '600',
  },
  inputBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  input: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 4,
  },
});
