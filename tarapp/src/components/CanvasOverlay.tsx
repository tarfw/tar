import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Pressable, StyleSheet, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SecureStore from 'expo-secure-store';

import { tar } from '@/lib/tar';
import { parseDesignTokens } from '@/lib/design-tokens';
import { parseYamlFrontmatter, parseCanvasMarkdown, buildModuleLayout } from '@/lib/layout-engine';
import { TarLogoLoader } from '@/components/TarLogoLoader';
import WorkspaceCanvas from '@/components/WorkspaceCanvas';
import ContactDetailsModal from '@/components/ContactDetailsModal';

function parseModules(md: string): string[] {
  const match = md.match(/\*\*Modules:\*\*\s*(.+)/i);
  if (!match) return [];
  return match[1].split(',').map((m) => m.trim().toLowerCase()).filter(Boolean);
}

function filterActiveRows(rows: any[]) {
  return (rows || []).filter((r: any) => {
    if (!r) return false;
    const statusStr = String(r.status || '').toLowerCase();
    const typeStr = String(r.type || '').toLowerCase();
    return statusStr !== 'deleted' && statusStr !== 'archived' && typeStr !== 'deleted' && !r.deleted;
  });
}

interface CanvasOverlayProps {
  visible: boolean;
  onClose: () => void;
  theme: any;
  scope?: string;
  subdomain?: string;
}

export default function CanvasOverlay({ visible, onClose, theme, scope: propScope, subdomain: propSubdomain }: CanvasOverlayProps) {
  const insets = useSafeAreaInsets();

  const [scope, setScope] = useState<string | null>(propScope ?? null);
  const [subdomain, setSubdomain] = useState(propSubdomain ?? '');
  const [loading, setLoading] = useState(true);
  const [designTokens, setDesignTokens] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [layouts, setLayouts] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (propScope) {
      setScope(propScope);
      setSubdomain(propSubdomain ?? '');
      return;
    }
    (async () => {
      const sub = await SecureStore.getItemAsync('active_workspace_subdomain').catch(() => null);
      const data = await tar.listWorkspaces().catch(() => ({ workspaces: [] }));
      const list = data.workspaces || [];
      const found = list.find((w: any) => w.subdomain === sub) || list[0];
      setScope(found?.scope ?? null);
      setSubdomain(found?.subdomain ?? '');
    })();
  }, [visible, propScope, propSubdomain]);

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    try {
      const [designRes, indexRes, canvasRes, matterRes] = await Promise.all([
        tar.okf.read(scope, 'DESIGN.md').catch(() => null),
        tar.okf.readIndex(scope).catch(() => null),
        tar.okf.read(scope, 'team/canvas.md').catch(() => null),
        tar.tool('read', { table: 'matter', scope }).catch(() => null),
      ]);

      if (designRes?.content) {
        const { frontmatter } = parseYamlFrontmatter(designRes.content);
        setDesignTokens(parseDesignTokens(frontmatter));
      }

      const rows = filterActiveRows(matterRes?.rows || []);
      setEntities(rows);

      let modules: string[] = [];
      if (indexRes?.content) {
        modules = parseModules(indexRes.content);
        const fetched = await Promise.all(
          modules.map(async (mod) => {
            const fileRes = await tar.okf.read(scope, `skills/${mod}.md`).catch(() => null);
            return fileRes?.content ? buildModuleLayout(mod, fileRes.content) : null;
          })
        );
        setLayouts(fetched.filter(Boolean) as any[]);
      }

      if (canvasRes?.content) {
        setBlocks(parseCanvasMarkdown(canvasRes.content).blocks);
      } else {
        const activeList = modules.length > 0 ? modules : ['orders', 'inventory', 'crm', 'reports'];
        setBlocks(
          activeList.map((mod) => ({
            title: mod.charAt(0).toUpperCase() + mod.slice(1),
            type: mod === 'orders' || mod === 'transactions' ? 'pos-sale' : 'data-grid',
            props: {
              type: mod === 'orders' || mod === 'transactions' ? 'order' : mod === 'inventory' ? 'product' : mod,
              mode: 'table',
            },
          }))
        );
      }
    } catch (e) {
      console.warn('[CanvasOverlay] Failed to load workspace specs:', e);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    if (visible && scope) load();
  }, [visible, scope, load]);

  const products = entities.filter((e) => e.type === 'product');
  const orders = entities.filter((e) => e.type === 'order');

  const effectiveTokens = designTokens || {
    colors: { primary: theme.primary || '#0f172a', secondary: '#3b82f6', background: '#ffffff' },
    rounded: { sm: 8, md: 12, lg: 16 },
    spacing: { sm: 8, md: 16 },
    typography: {},
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.panel, { backgroundColor: theme.background, paddingTop: insets.top + 8 }]}>
        {/* Close button */}
        <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={theme.textMuted} />
        </Pressable>

        {/* Content */}
        <View style={styles.content}>
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <TarLogoLoader size={36} color={theme.primary} />
            </View>
          ) : !scope ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>Select a workspace first.</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingBottom: 16 }}
              refreshControl={<RefreshControl refreshing={false} onRefresh={load} colors={[theme.primary]} />}
            >
              <WorkspaceCanvas
                designTokens={effectiveTokens}
                blocks={blocks}
                layouts={layouts}
                onExecuteAction={async (actionName, params) => {
                  if (actionName === 'view_entity' && params?.entity) {
                    setSelectedEntity(params.entity);
                    return { success: true };
                  }
                  await load();
                  return { success: true };
                }}
                metricsData={{
                  orders: orders.length,
                  inventory: products.length,
                  bookings: entities.filter((e) => e.type === 'booking').length,
                }}
                tableData={{
                  orders,
                  inventory: products,
                  order: orders,
                  product: products,
                  directory: entities,
                  'entity-directory': entities,
                  'plan5-directory': entities,
                }}
              />
            </ScrollView>
          )}
        </View>

        <ContactDetailsModal
          visible={selectedEntity !== null}
          entity={selectedEntity}
          scope={scope ?? undefined}
          theme={theme}
          onClose={() => setSelectedEntity(null)}
          onRefresh={load}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    paddingHorizontal: 12,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginTop: 4,
    padding: 4,
  },
  content: {
    flex: 1,
  },
});
