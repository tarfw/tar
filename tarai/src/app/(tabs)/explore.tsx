import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useState, useEffect } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

const TARFLUE_URL = process.env.EXPO_PUBLIC_TARFLUE_URL || 'https://tarflue.tar-54d.workers.dev';

interface Template {
  id: string;
  name: string;
  description: string;
  modules: string[];
}

export default function ExploreScreen() {
  const theme = useTheme();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async (query?: string) => {
    setLoading(true);
    try {
      const url = query
        ? `${TARFLUE_URL}/marketplace/templates?q=${encodeURIComponent(query)}`
        : `${TARFLUE_URL}/marketplace/templates`;
      const res = await fetch(url);
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (e) {
      console.warn('[Explore] Failed to fetch templates:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchTemplates(searchQuery || undefined);
  };

  const handleInstall = async (templateId: string) => {
    setInstalling(templateId);
    try {
      const res = await fetch(`${TARFLUE_URL}/marketplace/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, scope: 'global' }),
      });
      const data = await res.json();
      console.log('[Explore] Installed:', data);
    } catch (e) {
      console.warn('[Explore] Install failed:', e);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.header, { color: theme.text }]}>Explore</Text>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Ionicons name="search" size={20} color={theme.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search templates..."
          placeholderTextColor={theme.textMuted}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
      </View>

      {/* Templates */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>TEMPLATES</Text>
        {loading ? (
          <Text style={[styles.loading, { color: theme.textMuted }]}>Loading...</Text>
        ) : templates.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Ionicons name="storefront-outline" size={32} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No templates found</Text>
          </View>
        ) : (
          templates.map((tpl) => (
            <View
              key={tpl.id}
              style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{tpl.name}</Text>
                <Pressable
                  style={[styles.installButton, { backgroundColor: theme.primary }]}
                  onPress={() => handleInstall(tpl.id)}
                  disabled={installing === tpl.id}>
                  <Text style={styles.installButtonText}>
                    {installing === tpl.id ? 'Installing...' : 'Install'}
                  </Text>
                </Pressable>
              </View>
              <Text style={[styles.cardDescription, { color: theme.textMuted }]}>{tpl.description}</Text>
              <View style={styles.moduleList}>
                {(tpl.modules || []).map((mod, i) => (
                  <View key={i} style={[styles.moduleTag, { backgroundColor: theme.primary + '20' }]}>
                    <Text style={[styles.moduleTagText, { color: theme.primary }]}>{mod}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>QUICK ACTIONS</Text>
        <View style={styles.grid}>
          {[
            { icon: 'add-circle-outline', label: 'New Workspace', action: 'chat' },
            { icon: 'storefront-outline', label: 'Marketplace', action: 'explore' },
            { icon: 'settings-outline', label: 'Settings', action: 'settings' },
          ].map((item, i) => (
            <Pressable
              key={i}
              style={[styles.gridItem, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <Ionicons name={item.icon as any} size={24} color={theme.primary} />
              <Text style={[styles.gridLabel, { color: theme.text }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 60 },
  header: { fontSize: 32, fontWeight: '800', marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 8, marginBottom: 24 },
  searchInput: { flex: 1, fontSize: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  loading: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  emptyCard: { padding: 32, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardDescription: { fontSize: 14, marginBottom: 12 },
  installButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  installButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  moduleList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  moduleTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  moduleTagText: { fontSize: 12, fontWeight: '500' },
  grid: { flexDirection: 'row', gap: 12 },
  gridItem: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  gridLabel: { fontSize: 12, marginTop: 8, textAlign: 'center' },
});
