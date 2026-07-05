import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { tar } from '@/lib/tar';

interface Template {
  id: string;
  name: string;
  description: string;
  modules: string[];
}

interface Workspace {
  scope: string;
  role: string;
  name?: string;
  subdomain?: string;
}

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const data = await tar.listWorkspaces();
      setWorkspaces(data.workspaces || []);
    } catch (e) {
      console.warn('[Explore] Failed to fetch workspaces:', e);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async (query?: string) => {
    setLoading(true);
    try {
      const data = await tar.templates(query);
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
      const data = await tar.installTemplate(templateId, 'global');
      console.log('[Explore] Installed:', data);
    } catch (e) {
      console.warn('[Explore] Install failed:', e);
    } finally {
      setInstalling(null);
    }
  };

  const handleWorkspacePress = (w: Workspace) => {
    router.push({
      pathname: '/workspace',
      params: {
        id: w.scope,
        name: w.name || w.scope,
        subdomain: w.subdomain || w.scope.replace('w:', ''),
        scope: w.scope,
      },
    });
  };

  const handleQuickAction = (action: string) => {
    if (action === 'onboarding') {
      router.push('/onboarding');
    } else if (action === 'settings') {
      router.push('/(tabs)/settings');
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

      {/* My Workspaces */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>MY WORKSPACES</Text>
        {workspaces.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Ionicons name="briefcase-outline" size={28} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted, fontSize: 14 }]}>
              No workspaces created yet.
            </Text>
            <Pressable
              style={[styles.createBtn, { backgroundColor: theme.primary }]}
              onPress={() => router.push('/onboarding')}>
              <Text style={styles.createBtnText}>Create Workspace</Text>
            </Pressable>
          </View>
        ) : (
          workspaces.map((w) => {
            const subdomain = w.subdomain || w.scope.replace('w:', '');
            return (
              <Pressable
                key={w.scope}
                style={({ pressed }) => [
                  styles.workspaceCard,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => handleWorkspacePress(w)}>
                <View style={styles.workspaceInfo}>
                  <Text style={[styles.workspaceTitle, { color: theme.text }]}>
                    {w.name || subdomain}
                  </Text>
                  <Text style={[styles.workspaceSubdomain, { color: theme.textMuted }]}>
                    {subdomain}.tarai.space
                  </Text>
                </View>
                <View style={[styles.verticalTag, { backgroundColor: theme.primary + '15' }]}>
                  <Text style={[styles.verticalTagText, { color: theme.primary }]}>{w.role}</Text>
                </View>
              </Pressable>
            );
          })
        )}
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
            { icon: 'add-circle-outline', label: 'New Workspace', action: 'onboarding' },
            { icon: 'settings-outline', label: 'Settings', action: 'settings' },
          ].map((item, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.gridItem,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                pressed && { opacity: 0.7 }
              ]}
              onPress={() => handleQuickAction(item.action)}>
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
  content: { padding: 16, paddingTop: 60, paddingBottom: 40 },
  header: { fontSize: 32, fontWeight: '800', marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 8, marginBottom: 24 },
  searchInput: { flex: 1, fontSize: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  loading: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  emptyCard: { padding: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  createBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  workspaceCard: { flexDirection: 'row', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 8, alignItems: 'center', justifyContent: 'space-between' },
  workspaceInfo: { flex: 1, gap: 2 },
  workspaceTitle: { fontSize: 16, fontWeight: '600' },
  workspaceSubdomain: { fontSize: 13 },
  verticalTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  verticalTagText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
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

