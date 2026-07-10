import { StyleSheet, View, Text, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DesignTokens, resolveTokenValue } from '../lib/design-tokens';
import { WorkspaceModuleLayout, UISection, WorkspaceAction } from '../lib/layout-engine';
import { useTheme } from '@/hooks/use-theme';

interface WorkspaceCanvasProps {
  designTokens: DesignTokens;
  layouts: WorkspaceModuleLayout[];
  onExecuteAction: (actionName: string, params: Record<string, any>) => Promise<any>;
  metricsData?: Record<string, string | number>;
  tableData?: Record<string, any[]>;
}

const mapIconName = (name: string): any => {
  const clean = name.toLowerCase().trim();
  if (clean === 'x-circle') return 'close-circle';
  if (clean === 'plus-circle') return 'add-circle';
  if (clean === 'calendar-x') return 'calendar-outline';
  return clean;
};

export default function WorkspaceCanvas({
  designTokens,
  layouts,
  onExecuteAction,
  metricsData = {},
  tableData = {},
}: WorkspaceCanvasProps) {
  const theme = useTheme();

  const colors = designTokens.colors || {};
  const primaryColor = colors.primary || '#1B4332';
  const secondaryColor = colors.secondary || '#2D6A4F';
  const tertiaryColor = colors.tertiary || '#D4A373';
  const neutralColor = colors.neutral || '#FEFAE0';
  const onPrimaryColor = colors['on-primary'] || '#FFFFFF';

  const roundedSm = designTokens.rounded.sm ?? 6;
  const roundedMd = designTokens.rounded.md ?? 12;
  const spacingSm = designTokens.spacing.sm ?? 8;
  const spacingMd = designTokens.spacing.md ?? 16;
  const spacingLg = designTokens.spacing.lg ?? 24;

  const renderSection = (section: UISection, layout: WorkspaceModuleLayout, index: number) => {
    const sectionKey = `sec_${layout.moduleName}_${section.type}_${index}`;

    if (section.type === 'quick-actions') {
      return null;
    }

    if (section.type === 'metric-card') {
      // Metrics are now grouped and rendered at the top level of the module block
      return null;
    }

    if (section.type === 'data-table' || section.type === 'timeline-feed' || section.type === 'booking-grid' || section.type === 'catalog-grid') {
      const rows = tableData[layout.moduleName] || [];
      return (
        <View key={sectionKey} style={[styles.sectionContainer, { marginBottom: spacingLg }]}>
          <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }]}>
            {section.title || 'Records'}
          </Text>
          <View
            style={[
              styles.tableContainer,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                borderRadius: roundedMd,
                padding: spacingSm,
              },
            ]}
          >
            {rows.length === 0 ? (
              <Text style={{ color: theme.textMuted, fontSize: 13, padding: 12, textAlign: 'center' }}>
                No active records
              </Text>
            ) : (
              rows.map((row, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.tableRow,
                    {
                      borderBottomWidth: idx < rows.length - 1 ? StyleSheet.hairlineWidth : 0,
                      borderBottomColor: theme.border,
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>
                      {row.title || row.id}
                    </Text>
                    {row.value !== undefined && (
                      <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
                        ${row.value}
                      </Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                    {row.subtitle || row.description || row.type || ''}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      {layouts.map(layout => {
        const metrics = layout.sections.filter(s => s.type === 'metric-card');
        const others = layout.sections.filter(s => s.type !== 'metric-card');

        return (
          <View key={layout.moduleName} style={styles.moduleBlock}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacingSm + 4 }}>
              <Ionicons name="cube-outline" size={16} color={theme.textSecondary} style={{ marginRight: 6 }} />
              <Text style={[styles.moduleTitle, { color: theme.text, fontWeight: '700', fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase' }]}>
                {layout.moduleName}
              </Text>
            </View>

            {/* Render metrics side by side in a row */}
            {metrics.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: spacingMd }}>
                {metrics.map((section, idx) => {
                  const metricValue = metricsData[section.title || ''] || metricsData[layout.moduleName] || '0';
                  return (
                    <View
                      key={`metric_${idx}`}
                      style={[
                        styles.metricCard,
                        {
                          flex: 1,
                          minWidth: '45%',
                          backgroundColor: theme.backgroundElement,
                          borderColor: theme.border,
                          borderRadius: roundedMd,
                          padding: spacingMd,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '500' }}>
                          {section.title || 'Metrics'}
                        </Text>
                        <Ionicons name="trending-up-outline" size={14} color={theme.textMuted} />
                      </View>
                      <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text, marginTop: 6 }}>
                        {metricValue}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {others.map((section, idx) => renderSection(section, layout, idx))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  moduleBlock: { marginBottom: 24 },
  moduleTitle: { fontSize: 14, letterSpacing: 1 },
  sectionContainer: { marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionBtn: {
    width: '47%',
    aspectRatio: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnLabel: { fontSize: 13, textAlign: 'center' },
  metricCard: {
    borderWidth: 1,
  },
  tableContainer: {
    borderWidth: 1,
  },
  tableRow: {},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  submitBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
});
