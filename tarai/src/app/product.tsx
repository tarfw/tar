import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Pressable, View, TextInput, Text, ActivityIndicator, Modal } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { suggestProductDetails } from '@/lib/ai';

function parseData(data: string): Record<string, any> {
  try { return JSON.parse(data); } catch { return {}; }
}

const COLOR_MAP: Record<string, string> = {
  black: '#1a1a1a', white: '#f5f5f5', red: '#FF3B30', blue: '#007AFF', green: '#34C759',
  yellow: '#FFCC00', orange: '#FF9500', pink: '#FF2D55', purple: '#AF52DE', gray: '#8E8E93',
  grey: '#8E8E93', brown: '#A2845E', beige: '#F5F5DC', navy: '#000080', teal: '#5AC8FA',
  gold: '#FFD700', silver: '#C0C0C0', maroon: '#800000', olive: '#808000', cyan: '#00FFFF',
};

function getColorHex(name: string): string | null {
  const lower = name.toLowerCase().trim();
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  if (/^#[0-9a-f]{6}$/i.test(lower)) return lower;
  return null;
}

interface Marketing {
  headline: string;
  shortDesc: string;
  features: string[];
  seoTitle: string;
  seoDesc: string;
  seoKeywords: string[];
  socialCaption: string;
  badge: string;
}

const DEFAULT_MARKETING: Marketing = {
  headline: '', shortDesc: '', features: [], seoTitle: '', seoDesc: '',
  seoKeywords: [], socialCaption: '', badge: '',
};

type AiSection = 'description' | 'tags' | 'options' | 'modifiers' | 'headline' | 'features' | 'social' | 'seo';

export default function ProductScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const db = useDb();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; mode?: 'create' | 'edit' }>();
  const isNew = params.mode === 'create' || !params.id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedSection, setSelectedSection] = useState<AiSection | null>(null);

  const [localTitle, setLocalTitle] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState('');
  const [modifiers, setModifiers] = useState('');
  const [marketing, setMarketing] = useState<Marketing>(DEFAULT_MARKETING);
  const [files, setFiles] = useState<any[]>([]);

  const [showMenu, setShowMenu] = useState(false);
  const [detailTab, setDetailTab] = useState<'details' | 'marketing' | 'files'>('details');
  const [aiQuery, setAiQuery] = useState('');

  const loadProduct = useCallback(async () => {
    if (isNew || !params.id) return;
    setLoading(true);
    try {
      const row = await db.getFirstAsync<any>('SELECT * FROM form WHERE id = ?', params.id);
      if (row) {
        setLocalTitle(row.title || '');
        const data = parseData(row.data);
        setCategory(data.category || '');
        setTags(data.tags || '');
        setDescription(data.description || '');
        setOptions(data.options || '');
        setModifiers(data.modifiers || '');
        if (data.marketing) setMarketing({ ...DEFAULT_MARKETING, ...data.marketing });

        const fileRows = await db.getAllAsync<any>(
          "SELECT * FROM matter WHERE form = ? AND type = 'file' AND active = 1 ORDER BY time DESC",
          params.id
        );
        setFiles(fileRows);
      }
    } finally {
      setLoading(false);
    }
  }, [params.id, isNew, db]);

  useEffect(() => { loadProduct(); }, [loadProduct]);

  const handleAiSection = (section: AiSection) => {
    if (aiLoading) return;
    console.log(`[Product] Section selected: ${section}`);
    setSelectedSection(section === selectedSection ? null : section);
  };

  const handleAiGenerate = async () => {
    if (!localTitle.trim()) return;
    console.log(`[Product] AI generate all started for: "${localTitle.trim()}"`);
    setAiLoading(true);
    try {
      const suggestion = await suggestProductDetails(localTitle.trim());
      console.log(`[Product] AI generate all response:`, JSON.stringify(suggestion).slice(0, 300));
      if (suggestion.category) setCategory(suggestion.category);
      if (suggestion.description) setDescription(suggestion.description);
      if (suggestion.tags?.length) setTags(suggestion.tags.join(', '));
      if (suggestion.options?.length) {
        const allValues = suggestion.options.flatMap(o => o.values);
        setOptions(allValues.join(', '));
      }
      if (suggestion.modifiers?.length) {
        const modStrings = suggestion.modifiers.map(m => m.price ? `${m.name} +₹${m.price}` : m.name);
        setModifiers(modStrings.join(', '));
      }
      if (suggestion.marketing) setMarketing(suggestion.marketing);
      console.log(`[Product] AI generate all completed`);
    } catch (e) {
      console.error(`[Product] AI generate all failed:`, e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveTitle = async () => {
    if (isNew || !params.id || !localTitle.trim()) return;
    await db.runAsync('UPDATE form SET title = ? WHERE id = ?', localTitle.trim(), params.id);
  };

  const handleSave = async () => {
    if (!localTitle.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const data = { category, tags, description, options, modifiers, marketing };

      if (isNew) {
        const id = `prod_${Date.now()}`;
        await db.runAsync(
          'INSERT INTO form (id, type, title, scope, data, time, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
          id, 'product', localTitle.trim(), 'p', JSON.stringify(data), now
        );
      } else {
        await db.runAsync(
          'UPDATE form SET title = ?, data = ? WHERE id = ?',
          localTitle.trim(), JSON.stringify(data), params.id
        );
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!params.id) return;
    await db.runAsync('UPDATE form SET active = 0 WHERE id = ?', params.id);
    setShowMenu(false);
    router.back();
  };

  const handleAiInput = async () => {
    if (!aiQuery.trim()) return;
    const q = aiQuery.trim();

    if (selectedSection) {
      console.log(`[Product] Applying input to section: ${selectedSection}`);
      switch (selectedSection) {
        case 'description':
          setDescription(q);
          break;
        case 'tags':
          setTags(q);
          break;
        case 'options':
          setOptions(q);
          break;
        case 'modifiers':
          setModifiers(q);
          break;
        case 'headline':
          setMarketing({ ...marketing, headline: q });
          break;
        case 'features':
          setMarketing({ ...marketing, features: q.split(',').map(v => v.trim()).filter(Boolean) });
          break;
        case 'social':
          setMarketing({ ...marketing, socialCaption: q });
          break;
        case 'seo':
          setMarketing({ ...marketing, seoTitle: q });
          break;
      }
      setSelectedSection(null);
      setAiQuery('');
      return;
    }

    setAiLoading(true);
    try {
      const ql = q.toLowerCase();
      if (ql.includes('tag')) {
        setTags(q);
      } else if (ql.includes('option') || ql.includes('variant') || ql.includes('size') || ql.includes('color')) {
        setOptions(q);
      } else if (ql.includes('modifier') || ql.includes('wrap') || ql.includes('engrave') || ql.includes('add')) {
        setModifiers(q);
      } else if (ql.includes('category')) {
        setCategory(q);
      } else if (ql.includes('headline') || ql.includes('caption') || ql.includes('seo')) {
        setMarketing({ ...marketing, headline: q });
      } else {
        setDescription(q);
      }
    } finally {
      setAiLoading(false);
      setAiQuery('');
    }
  };

  const parseOptions = (str: string): string[] => {
    if (!str) return [];
    return str.split(',').map(v => v.trim()).filter(Boolean);
  };

  const parseModifiers = (str: string): { name: string; price?: string }[] => {
    if (!str) return [];
    return str.split(',').map(v => {
      const match = v.trim().match(/^(.+?)(?:\s*\+\s*₹?\s*(\d+))?$/);
      return { name: match?.[1]?.trim() || v.trim(), price: match?.[2] };
    }).filter(m => m.name);
  };

  const SectionContainer = ({ section, children }: { section: AiSection; children: React.ReactNode }) => (
    <Pressable
      style={({ pressed }) => [
        styles.sectionContainer,
        pressed && { opacity: 0.6 },
        selectedSection === section && { backgroundColor: `${theme.backgroundElement}80`, borderRadius: 12, marginHorizontal: 12, paddingHorizontal: 4, paddingVertical: 8, marginTop: 10 },
      ]}
      onPress={() => handleAiSection(section)}
      disabled={aiLoading}>
      {children}
    </Pressable>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled">

        {/* Thumbnail + Title Input */}
        <View style={styles.titleRow}>
          <View style={[styles.thumbnail, { backgroundColor: '#10B98120' }]}>
            <Text style={[styles.thumbnailText, { color: '#10B981' }]}>
              {localTitle.charAt(0).toUpperCase() || 'P'}
            </Text>
          </View>
          <View style={styles.titleInfo}>
            <TextInput
              style={[styles.titleInput, { color: theme.text }]}
              value={localTitle}
              onChangeText={setLocalTitle}
              onBlur={handleSaveTitle}
              placeholder="Product name"
              placeholderTextColor={theme.textSecondary}
              autoFocus={isNew}
            />
            {category ? (
              <Text style={[styles.categorySubtext, { color: theme.textSecondary }]}>{category}</Text>
            ) : null}
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, detailTab === 'details' && { borderBottomColor: '#5E6AD2' }]}
            onPress={() => setDetailTab('details')}>
            <Text style={[styles.tabText, { color: detailTab === 'details' ? '#5E6AD2' : theme.textSecondary }]}>
              Details
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, detailTab === 'marketing' && { borderBottomColor: '#5E6AD2' }]}
            onPress={() => setDetailTab('marketing')}>
            <Text style={[styles.tabText, { color: detailTab === 'marketing' ? '#5E6AD2' : theme.textSecondary }]}>
              Marketing
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, detailTab === 'files' && { borderBottomColor: '#5E6AD2' }]}
            onPress={() => setDetailTab('files')}>
            <Text style={[styles.tabText, { color: detailTab === 'files' ? '#5E6AD2' : theme.textSecondary }]}>
              Files
            </Text>
          </Pressable>
        </View>

        {/* Details Tab */}
        {detailTab === 'details' && (
          <>
            <SectionContainer section="description">
              {description ? (
                <View style={styles.sectionContent}>
                  <Text style={[styles.descriptionText, { color: theme.text }]}>{description}</Text>
                </View>
              ) : (
                <View style={styles.sectionContent}>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Tap to add description</Text>
                </View>
              )}
            </SectionContainer>

            <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

            <SectionContainer section="options">
              <View style={styles.sectionContent}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Options</Text>
                {options ? (
                  <View style={styles.chipsWrap}>
                    {parseOptions(options).map((opt, i) => {
                      const colorHex = getColorHex(opt);
                      return (
                        <View key={i} style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                          {colorHex && <View style={[styles.colorDot, { backgroundColor: colorHex, borderWidth: colorHex === '#f5f5f5' ? 1 : 0, borderColor: '#ddd' }]} />}
                          <Text style={[styles.chipText, { color: theme.text }]}>{opt}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Tap to generate</Text>
                )}
              </View>
            </SectionContainer>

            <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

            <SectionContainer section="modifiers">
              <View style={styles.sectionContent}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Modifiers</Text>
                {modifiers ? (
                  <View style={styles.chipsWrap}>
                    {parseModifiers(modifiers).map((mod, i) => (
                      <View key={i} style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                        <Ionicons name="add-circle-outline" size={14} color="#5E6AD2" />
                        <Text style={[styles.chipText, { color: theme.text }]}>{mod.name}</Text>
                        {mod.price ? <Text style={[styles.chipPrice, { color: '#10B981' }]}>+₹{mod.price}</Text> : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Tap to generate</Text>
                )}
              </View>
            </SectionContainer>
          </>
        )}

        {/* Marketing Tab */}
        {detailTab === 'marketing' && (
          <>
            <SectionContainer section="headline">
              <View style={styles.sectionContent}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Headline</Text>
                {marketing.headline ? (
                  <Text style={[styles.headlineText, { color: theme.text }]}>{marketing.headline}</Text>
                ) : (
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Tap to generate</Text>
                )}
              </View>
            </SectionContainer>

            <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

            <SectionContainer section="tags">
              <View style={styles.sectionContent}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Tags</Text>
                {tags ? (
                  <View style={styles.chipsWrap}>
                    {tags.split(',').map((tag, i) => (
                      <View key={i} style={[styles.chip, { backgroundColor: '#5E6AD215' }]}>
                        <Text style={[styles.chipText, { color: '#5E6AD2' }]}>{tag.trim()}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Tap to generate</Text>
                )}
              </View>
            </SectionContainer>

            <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

            <SectionContainer section="features">
              <View style={styles.sectionContent}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Key Features</Text>
                {marketing.features.length > 0 ? (
                  marketing.features.map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={[styles.featureText, { color: theme.text }]}>{f}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Tap to generate</Text>
                )}
              </View>
            </SectionContainer>

            <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

            <SectionContainer section="social">
              <View style={styles.sectionContent}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Social Caption</Text>
                {marketing.socialCaption ? (
                  <Text style={[styles.socialText, { color: theme.text }]}>{marketing.socialCaption}</Text>
                ) : (
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Tap to generate</Text>
                )}
              </View>
            </SectionContainer>

            <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

            <SectionContainer section="seo">
              <View style={styles.sectionContent}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>SEO</Text>
                {marketing.seoTitle ? (
                  <View style={[styles.seoCard, { backgroundColor: theme.backgroundElement }]}>
                    <Text style={[styles.seoTitle, { color: theme.text }]}>{marketing.seoTitle}</Text>
                    <Text style={[styles.seoDesc, { color: theme.textSecondary }]} numberOfLines={2}>{marketing.seoDesc}</Text>
                    <View style={styles.seoKeywords}>
                      {marketing.seoKeywords.map((kw, i) => (
                        <View key={i} style={[styles.seoKeyword, { backgroundColor: `${theme.textSecondary}15` }]}>
                          <Text style={[styles.seoKeywordText, { color: theme.textSecondary }]}>{kw}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Tap to generate</Text>
                )}
              </View>
            </SectionContainer>
          </>
        )}

        {/* Files Tab */}
        {detailTab === 'files' && (
          <>
            {files.map((file, i) => {
              const fd = parseData(file.data);
              return (
                <View key={i} style={styles.timelineRow}>
                  <View style={[styles.timelineDot, { backgroundColor: '#5E6AD2' }]} />
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineTitle, { color: theme.text }]}>
                      {file.title || fd.name || 'Untitled'}
                    </Text>
                    <Text style={[styles.timelineMeta, { color: theme.textSecondary }]}>
                      {fd.size ? `${(fd.size / 1024).toFixed(1)} KB` : ''}
                      {file.time ? ` · ${new Date(file.time).toLocaleDateString()}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
            {files.length === 0 && (
              <Text style={[styles.emptyFiles, { color: theme.textSecondary }]}>No files attached</Text>
            )}
          </>
        )}
      </KeyboardAwareScrollView>

      {/* Save Chip */}
      <View style={[styles.chipBar, { paddingBottom: 8 }]}>
        <Pressable
          style={({ pressed }) => [styles.chipBtn, pressed && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving || !localTitle.trim()}>
          {saving ? (
            <ActivityIndicator size="small" color="#5E6AD2" />
          ) : (
            <Ionicons name="checkmark" size={16} color={localTitle.trim() ? '#5E6AD2' : theme.textSecondary} />
          )}
          <Text style={[styles.chipBtnText, { color: localTitle.trim() ? '#5E6AD2' : theme.textSecondary }]}>Save</Text>
        </Pressable>
      </View>

      {/* Bottom AI Input Bar */}
      <KeyboardStickyView offset={{ closed: 0, opened: 0 }} style={{ paddingBottom: insets.bottom }}>
        <View style={[styles.inputBarFixed, { backgroundColor: theme.background, borderTopColor: 'rgba(0,0,0,0.1)' }]}>
          <View style={[styles.inputBarInner, { backgroundColor: theme.backgroundElement }]}>
            <Pressable onPress={handleAiGenerate} disabled={aiLoading || !localTitle.trim()}>
              {aiLoading ? (
                <ActivityIndicator size="small" color="#5E6AD2" />
              ) : (
                <Ionicons name="flash" size={20} color={localTitle.trim() ? '#5E6AD2' : theme.textSecondary} />
              )}
            </Pressable>
            <TextInput
              style={[styles.inputBarText, { color: theme.text }]}
              value={aiQuery}
              onChangeText={setAiQuery}
              placeholder={selectedSection ? `Edit ${selectedSection}...` : 'Ask AI to update product...'}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="send"
              onSubmitEditing={handleAiInput}
              autoFocus={!!selectedSection}
            />
            {aiQuery.trim().length > 0 && (
              <Pressable onPress={handleAiInput} disabled={aiLoading} style={styles.sendBtn}>
                <Ionicons name="arrow-up-circle" size={24} color="#5E6AD2" />
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardStickyView>

      {/* Menu Bottom Sheet */}
      <Modal visible={showMenu} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dragHandle, { backgroundColor: theme.textSecondary }]} />
            <View style={styles.menuOptions}>
              <Pressable style={styles.menuOption} onPress={() => { setShowMenu(false); }}>
                <Ionicons name="copy-outline" size={20} color={theme.text} />
                <Text style={[styles.menuOptionText, { color: theme.text }]}>Duplicate</Text>
              </Pressable>
              <View style={[styles.menuSeparator, { backgroundColor: theme.backgroundElement }]} />
              <Pressable style={styles.menuOption} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                <Text style={[styles.menuOptionText, { color: '#FF3B30' }]}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 14 },
  thumbnail: { width: 64, height: 64, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  thumbnailText: { fontSize: 28, fontWeight: '700' },
  titleInfo: { flex: 1 },
  titleInput: { fontSize: 22, fontWeight: '600', paddingVertical: 0 },
  categorySubtext: { fontSize: 13, marginTop: 2 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 24, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.1)' },
  tab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16, marginTop: 16 },
  sectionContainer: { marginHorizontal: 16, marginTop: 12 },
  sectionContent: {},
  sectionLoading: { position: 'absolute', top: 0, right: 0 },
  sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  descriptionText: { fontSize: 15, lineHeight: 22 },
  emptyText: { fontSize: 14, fontStyle: 'italic' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, gap: 6 },
  chipText: { fontSize: 13, fontWeight: '500' },
  chipPrice: { fontSize: 12, fontWeight: '600' },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  headlineText: { fontSize: 20, fontWeight: '700', lineHeight: 28 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  featureText: { flex: 1, fontSize: 14, lineHeight: 20 },
  socialText: { fontSize: 15, lineHeight: 24 },
  seoCard: { borderRadius: 12, padding: 14, gap: 8 },
  seoTitle: { fontSize: 15, fontWeight: '600' },
  seoDesc: { fontSize: 13, lineHeight: 18 },
  seoKeywords: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  seoKeyword: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  seoKeywordText: { fontSize: 11, fontWeight: '500' },
  timelineRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  timelineContent: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '500' },
  timelineMeta: { fontSize: 12, marginTop: 2 },
  emptyFiles: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  chipBar: { paddingLeft: 16, flexDirection: 'row', gap: 8 },
  chipBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, backgroundColor: '#5E6AD215', gap: 4 },
  chipBtnText: { fontSize: 14, fontWeight: '600' },
  inputBarFixed: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth },
  inputBarInner: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  inputBarText: { flex: 1, fontSize: 15, paddingVertical: 0 },
  sendBtn: { padding: 2 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '50%' },
  dragHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8, opacity: 0.3 },
  menuOptions: { paddingHorizontal: 20, paddingVertical: 16 },
  menuOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  menuOptionText: { fontSize: 16, fontWeight: '500' },
  menuSeparator: { height: 1, marginVertical: 8 },
});
