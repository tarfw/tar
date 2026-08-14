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

// ── 1. Visual Theme Presets (R2 .md Sync) ───────────────────────────
const THEME_PRESETS = [
  {
    id: 'planhat',
    name: 'Planhat Tech',
    vibe: 'Cinematic Obsidian · Ember Tag',
    category: 'SaaS / Tech',
    bg: '#000000',
    accent: '#E8552B',
  },
  {
    id: 'milo',
    name: 'Milo Fresh',
    vibe: 'Clean Botanical · Earthy Green',
    category: 'Cafe / Wellness',
    bg: '#032E1C',
    accent: '#1FCB60',
  },
  {
    id: 'kith',
    name: 'Kith Modern',
    vibe: 'Luxury Monochrome · Sharp Boxy',
    category: 'Streetwear / Retail',
    bg: '#111111',
    accent: '#FFFFFF',
  },
  {
    id: 'eql',
    name: 'EQL Launch',
    vibe: 'High-Heat Drops · Bold Badges',
    category: 'Limited Releases',
    bg: '#FFE600',
    accent: '#0A0A0C',
  },
  {
    id: 'joandso',
    name: 'JO & SO',
    vibe: 'Warm Editorial · Taupe & Sand',
    category: 'Boutique / Hotel',
    bg: '#F5F2EB',
    accent: '#2C2A29',
  },
  {
    id: 'empire',
    name: 'EMPIRE Dark',
    vibe: 'Deep Obsidian · Music Label',
    category: 'Creative / Music',
    bg: '#0A0A0C',
    accent: '#E5E7EB',
  },
];

const AI_SUGGESTIONS = [
  'Change hero headline to Summer Artisanal Collection',
  'Add a 20% discount announcement bar on top',
  'Switch product grid to 4 columns',
  'Make the background warmer taupe',
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

  const [activeThemeId, setActiveThemeId] = useState<string>('milo');
  const [instruction, setInstruction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const cleanSub = (subdomain || 'site').replace(/^w:/, '');
  const siteUrl = `https://${cleanSub}.tarai.space`;

  const handleOpenLiveSite = () => {
    Linking.openURL(siteUrl);
  };

  // ⚡ 1-Tap Instant Theme Switch (< 50ms via Cloudflare KV)
  const handleSwitchTheme = async (themeId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setFeedback(null);
    setActiveThemeId(themeId);

    try {
      const res = await fetch(`https://${cleanSub}.tarai.space/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subdomain: cleanSub,
          workspaceName: workspaceName || cleanSub,
          template: themeId,
        }),
      });

      if (res.ok) {
        setFeedback({ text: `Theme switched to ${themeId.toUpperCase()}! Live on Edge.`, type: 'success' });
      } else {
        setFeedback({ text: 'Theme switch failed. Retrying...', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Failed to switch theme.', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 🤖 AI Layout Customization / Patching
  const handleAiCustomize = async (customPrompt?: string) => {
    const text = (customPrompt || instruction).trim();
    if (!text || isProcessing) return;
    setIsProcessing(true);
    setFeedback(null);

    try {
      const productList = products.map((p) => ({
        name: p.title || p.name || 'Item',
        price: p.value || p.price || null,
        description: p.data?.description || '',
      }));

      const res = await fetch(`https://${cleanSub}.tarai.space/planner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: cleanSub,
          workspaceName: workspaceName || cleanSub,
          instruction: text,
          templateHint: activeThemeId,
          products: productList,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (data?.plan) {
        await saveDraft(data.plan);
        await publish(cleanSub, workspaceName || cleanSub);
        setInstruction('');
        setFeedback({ text: 'Storefront updated & published live!', type: 'success' });
      } else {
        setFeedback({ text: data?.error || 'AI update could not be applied.', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Customization failed.', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const sectionsList = (draft as any)?.routes?.[0]?.nodes || (draft as any)?.sections || [
    { type: 'announcement_bar', label: 'Announcement Bar' },
    { type: 'header_nav', label: 'Sticky Header Navigation' },
    { type: 'hero_banner', label: 'Hero Banner' },
    { type: 'product_grid', label: 'Product Catalog Grid' },
    { type: 'story_banner', label: 'Story & Brand Highlights' },
    { type: 'footer_strip', label: 'Footer Strip' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {/* Header */}
          <View style={[styles.headerBar, { paddingTop: Math.max(insets.top + 6, 14) }]}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>{workspaceName || 'Storefront'}</Text>
              <Text style={[styles.headerSub, { color: theme.textMuted }]}>{cleanSub}.tarai.space</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable onPress={handleOpenLiveSite} style={[styles.iconBtn, { borderColor: theme.border + '60' }]} hitSlop={8}>
                <Ionicons name="open-outline" size={16} color="#007AFF" />
              </Pressable>
              <Pressable onPress={onClose} style={[styles.iconBtn, { borderColor: theme.border + '60' }]} hitSlop={8}>
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Feedback Toast */}
          {feedback && (
            <View style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? '#10b98115' : '#ef444415' }]}>
              <Ionicons
                name={feedback.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={14}
                color={feedback.type === 'success' ? '#10b981' : '#ef4444'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#10b981' : '#ef4444' }]}>
                {feedback.text}
              </Text>
            </View>
          )}

          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Live Domain Card */}
            <Pressable
              onPress={handleOpenLiveSite}
              style={[styles.liveCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border + '50' }]}
            >
              <View style={styles.liveCardLeft}>
                <View style={styles.statusDot} />
                <View>
                  <Text style={[styles.liveDomain, { color: theme.text }]}>{cleanSub}.tarai.space</Text>
                  <Text style={[styles.liveMeta, { color: theme.textMuted }]}>100% Cloudflare Edge · Sub-2ms Latency</Text>
                </View>
              </View>
              <Ionicons name="arrow-forward" size={16} color="#007AFF" />
            </Pressable>

            {/* 1. VISUAL THEME SELECTOR */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SWITCH DESIGN THEME</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowList}>
                {THEME_PRESETS.map((t) => {
                  const isSelected = activeThemeId === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => handleSwitchTheme(t.id)}
                      disabled={isProcessing}
                      style={[
                        styles.themeCard,
                        {
                          borderColor: isSelected ? '#007AFF' : theme.border + '50',
                          borderWidth: isSelected ? 2 : 1,
                          backgroundColor: theme.backgroundElement,
                          opacity: isProcessing ? 0.7 : 1,
                        },
                      ]}
                    >
                      <View style={[styles.themeBanner, { backgroundColor: t.bg }]}>
                        <View style={[styles.themeDot, { backgroundColor: t.accent }]} />
                        {isSelected && <Ionicons name="checkmark-circle" size={15} color="#007AFF" style={styles.cardCheck} />}
                      </View>
                      <View style={styles.themeBody}>
                        <Text style={[styles.themeTitle, { color: theme.text }]}>{t.name}</Text>
                        <Text style={[styles.themeDesc, { color: theme.textMuted }]} numberOfLines={1}>
                          {t.vibe}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* 2. ACTIVE LAYOUT SECTIONS */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ACTIVE SECTIONS MANIFEST</Text>
              <View style={[styles.sectionsCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border + '50' }]}>
                {sectionsList.map((sec: any, idx: number) => {
                  const typeLabel = (sec.type || 'section').replace(/_/g, ' ');
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.sectionRow,
                        { borderBottomColor: theme.border + '25', borderBottomWidth: idx < sectionsList.length - 1 ? 1 : 0 },
                      ]}
                    >
                      <View style={styles.sectionDot} />
                      <Text style={[styles.sectionName, { color: theme.text }]}>{typeLabel}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 3. AI CUSTOMIZER & SUGGESTIONS */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>AI DESIGN INSTRUCTION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow}>
                {AI_SUGGESTIONS.map((sug, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setInstruction(sug)}
                    style={[styles.sugChip, { backgroundColor: theme.backgroundElement, borderColor: theme.border + '50' }]}
                  >
                    <Text style={[styles.sugText, { color: theme.textMuted }]}>{sug}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={[styles.aiInputContainer, { backgroundColor: theme.backgroundElement, borderColor: theme.border + '60' }]}>
                <TextInput
                  style={[styles.aiInput, { color: theme.text }]}
                  value={instruction}
                  onChangeText={setInstruction}
                  placeholder="e.g. Make hero headline bolder..."
                  placeholderTextColor={theme.textMuted}
                  editable={!isProcessing}
                />
                <Pressable
                  onPress={() => handleAiCustomize()}
                  disabled={isProcessing || !instruction.trim()}
                  style={[
                    styles.aiSendBtn,
                    {
                      backgroundColor: '#007AFF',
                      opacity: isProcessing || !instruction.trim() ? 0.5 : 1,
                    },
                  ]}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
                  )}
                </Pressable>
              </View>
            </View>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 16,
  },
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  liveCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  liveDomain: {
    fontSize: 14,
    fontWeight: '700',
  },
  liveMeta: {
    fontSize: 10,
    marginTop: 1,
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
  themeCard: {
    width: 145,
    borderRadius: 12,
    overflow: 'hidden',
  },
  themeBanner: {
    height: 30,
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
  sectionsCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#007AFF',
  },
  sectionName: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  suggestionRow: {
    gap: 6,
    paddingVertical: 2,
  },
  sugChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  sugText: {
    fontSize: 11,
  },
  aiInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  aiInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 4,
  },
  aiSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
