/**
 * WorkspaceCanvas — now uses ComponentRegistry for dynamic rendering.
 * Supports both legacy layouts and new OKF canvas.md blocks.
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { DesignTokens } from '../lib/design-tokens';
import { WorkspaceModuleLayout, CanvasBlock } from '../lib/layout-engine';
import { getComponent, hasComponent } from '../gen-ui/registry/ComponentRegistry';
import '../gen-ui/registry/builtins'; // Register all built-ins
import { useTheme } from '@/hooks/use-theme';

interface WorkspaceCanvasProps {
  designTokens: DesignTokens;
  layouts?: WorkspaceModuleLayout[];
  blocks?: CanvasBlock[];
  onExecuteAction: (actionName: string, params: Record<string, any>) => Promise<any>;
  metricsData?: Record<string, string | number>;
  tableData?: Record<string, any[]>;
}

export default function WorkspaceCanvas({
  designTokens,
  layouts = [],
  blocks = [],
  onExecuteAction,
  metricsData = {},
  tableData = {},
}: WorkspaceCanvasProps) {
  const theme = useTheme();

  // Convert old DesignTokens to new format for registry components
  const registryTokens = {
    colors: designTokens.colors || {},
    rounded: designTokens.rounded || {},
    spacing: designTokens.spacing || {},
    typography: designTokens.typography || {},
  };

  const hasBlocks = blocks && blocks.length > 0;

  return (
    <View style={styles.container}>
      {hasBlocks ? (
        blocks.map((block, idx) => {
          if (block.type === 'quick-actions') return null;

          if (!hasComponent(block.type)) {
            console.warn(`[WorkspaceCanvas] Unknown component type: ${block.type}`);
            return null;
          }

          const entry = getComponent(block.type);
          if (!entry) return null;

          const Component = entry.component;

          // Resolve data for this block
          let sectionData: any[] = [];
          if (block.type === 'metric-card') {
            const metricValue = metricsData[block.title || ''] || metricsData[block.props?.title || ''] || '0';
            sectionData = [{ value: metricValue, title: block.title || block.props?.title || 'Metric' }];
          } else {
            // Map tableData by type if available (e.g. products, orders)
            const typeKey = block.props?.type || block.props?.table || '';
            sectionData = tableData[typeKey] || [];
          }

          return (
            <View key={`block_${block.type}_${idx}`} style={styles.blockWrapper}>
              {block.title && (
                <Text
                  style={[
                    styles.blockTitle,
                    { color: theme.text, fontWeight: '700', fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
                  ]}
                >
                  {block.title}
                </Text>
              )}
              <Component
                type={block.type}
                props={block.props}
                designTokens={registryTokens}
                data={sectionData}
                onExecuteAction={onExecuteAction}
              />
            </View>
          );
        })
      ) : (
        // Legacy layout rendering fallback
        layouts.map((layout) => (
          <View key={layout.moduleName} style={styles.moduleBlock}>
            <Text
              style={[
                styles.moduleTitle,
                { color: theme.text, fontWeight: '700', fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
              ]}
            >
              {layout.moduleName}
            </Text>

            {layout.sections.map((section, idx) => {
              if (section.type === 'quick-actions') return null;

              if (!hasComponent(section.type)) {
                console.warn(`[WorkspaceCanvas] Unknown component type: ${section.type}`);
                return null;
              }

              const entry = getComponent(section.type);
              if (!entry) return null;

              const Component = entry.component;

              let sectionData: any[] = [];
              if (section.type === 'metric-card') {
                const metricValue = metricsData[section.title || ''] || metricsData[layout.moduleName] || '0';
                sectionData = [{ value: metricValue, title: section.title || 'Metric' }];
              } else if (section.type === 'data-table' || section.type === 'data-grid' || section.type === 'timeline-feed' || section.type === 'booking-grid' || section.type === 'catalog-grid' || section.type === 'pos-sale') {
                const typeKey = section.props?.type || layout.moduleName;
                sectionData = tableData[typeKey] || tableData[layout.moduleName] || [];
              }

              const isPosOrSale = section.type === 'pos-sale' || layout.moduleName === 'orders';
              return (
                <View
                  key={`sec_${layout.moduleName}_${section.type}_${idx}`}
                  style={{
                    marginBottom: 12,
                    minHeight: isPosOrSale ? 420 : undefined,
                  }}
                >
                  <Component
                    type={section.type}
                    props={{
                      title: section.title,
                      actions: section.actions,
                      data: section.data,
                      dataSource: section.dataSource,
                      entities: section.entities,
                    }}
                    designTokens={registryTokens}
                    data={sectionData}
                    onExecuteAction={onExecuteAction}
                  />
                </View>
              );
            })}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  moduleBlock: { marginBottom: 16 },
  moduleTitle: { fontSize: 13, letterSpacing: 0.8 },
  blockWrapper: { marginBottom: 20 },
  blockTitle: { fontSize: 13, letterSpacing: 0.8 },
});
