/**
 * WorkspaceCanvas — now uses ComponentRegistry for dynamic rendering.
 * No more hardcoded if/else switches.
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { DesignTokens } from '../lib/design-tokens';
import { WorkspaceModuleLayout, UISection } from '../lib/layout-engine';
import { getComponent, hasComponent } from '../gen-ui/registry/ComponentRegistry';
import '../gen-ui/registry/builtins'; // Register all built-ins
import { useTheme } from '@/hooks/use-theme';

interface WorkspaceCanvasProps {
  designTokens: DesignTokens;
  layouts: WorkspaceModuleLayout[];
  onExecuteAction: (actionName: string, params: Record<string, any>) => Promise<any>;
  metricsData?: Record<string, string | number>;
  tableData?: Record<string, any[]>;
}

export default function WorkspaceCanvas({
  designTokens,
  layouts,
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

  return (
    <View style={styles.container}>
      {layouts.map((layout) => (
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
            // Skip quick-actions — they belong in suggestion chips, not canvas
            if (section.type === 'quick-actions') return null;

            // Use registry lookup — no more if/else switches
            if (!hasComponent(section.type)) {
              // Unknown type = silent skip, never crash
              console.warn(`[WorkspaceCanvas] Unknown component type: ${section.type}`);
              return null;
            }

            const entry = getComponent(section.type);
            if (!entry) return null;

            const Component = entry.component;

            // Resolve data for this section
            let sectionData: any[] = [];
            if (section.type === 'metric-card') {
              const metricValue = metricsData[section.title || ''] || metricsData[layout.moduleName] || '0';
              sectionData = [{ value: metricValue, title: section.title || 'Metric' }];
            } else if (section.type === 'data-table' || section.type === 'timeline-feed' || section.type === 'booking-grid' || section.type === 'catalog-grid') {
              sectionData = tableData[layout.moduleName] || [];
            }

            return (
              <View key={`sec_${layout.moduleName}_${section.type}_${idx}`} style={{ marginBottom: 8 }}>
                <Component
                  type={section.type}
                  props={{
                    title: section.title,
                    actions: section.actions,
                    data: section.data,
                    dataSource: section.dataSource,
                  }}
                  designTokens={registryTokens}
                  data={sectionData}
                  onExecuteAction={onExecuteAction}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  moduleBlock: { marginBottom: 16 },
  moduleTitle: { fontSize: 13, letterSpacing: 0.8 },
});
