import { StyleSheet, View, Text, TouchableOpacity, TextInput, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { useState } from 'react';
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
  const [selectedAction, setSelectedAction] = useState<WorkspaceAction | null>(null);
  const [formParams, setFormParams] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

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

  const handleActionPress = (action: WorkspaceAction) => {
    if (action.params && action.params.length > 0) {
      const initialParams: Record<string, string> = {};
      action.params.forEach(p => {
        initialParams[p.name] = '';
      });
      setFormParams(initialParams);
      setSelectedAction(action);
      setResultMessage(null);
    } else {
      // Trigger execution directly if no params needed
      setSubmitting(true);
      onExecuteAction(action.name, {})
        .then((res) => {
          alert(`Successfully executed ${action.name.replace(/_/g, ' ')}`);
        })
        .catch((err) => {
          alert(`Error: ${err.message}`);
        })
        .finally(() => setSubmitting(false));
    }
  };

  const handleFormSubmit = async () => {
    if (!selectedAction) return;
    setSubmitting(true);
    setResultMessage(null);
    try {
      const cleanParams: Record<string, any> = {};
      selectedAction.params.forEach(p => {
        const val = formParams[p.name] || '';
        if (p.type === 'number') {
          cleanParams[p.name] = parseFloat(val) || 0;
        } else {
          cleanParams[p.name] = val;
        }
      });

      const res = await onExecuteAction(selectedAction.name, cleanParams);
      setResultMessage(res?.message || `Successfully executed ${selectedAction.name.replace(/_/g, ' ')}`);
      setTimeout(() => {
        setSelectedAction(null);
        setFormParams({});
        setResultMessage(null);
      }, 1500);
    } catch (err: any) {
      setResultMessage(`Error: ${err.message || 'Execution failed'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const renderSection = (section: UISection, layout: WorkspaceModuleLayout, index: number) => {
    const sectionKey = `sec_${layout.moduleName}_${section.type}_${index}`;

    if (section.type === 'quick-actions' && section.actions) {
      return (
        <View key={sectionKey} style={[styles.sectionContainer, { marginBottom: spacingLg }]}>
          <Text style={[styles.sectionTitle, { color: primaryColor, ...designTokens.typography.h2 }]}>
            {section.title || 'Quick Actions'}
          </Text>
          <View style={styles.actionsGrid}>
            {section.actions.map(actName => {
              const act = layout.actions[actName];
              if (!act) return null;
              return (
                <TouchableOpacity
                  key={actName}
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: tertiaryColor,
                      borderRadius: roundedMd,
                      padding: spacingMd,
                    },
                  ]}
                  onPress={() => handleActionPress(act)}
                >
                  <Ionicons name={mapIconName(act.icon || 'flash-outline')} size={24} color={onPrimaryColor} />
                  <Text style={[styles.actionBtnLabel, { color: onPrimaryColor, marginTop: 4, fontWeight: '600' }]}>
                    {act.name.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    if (section.type === 'metric-card') {
      const metricValue = metricsData[section.title || ''] || metricsData[layout.moduleName] || '0';
      return (
        <View
          key={sectionKey}
          style={[
            styles.metricCard,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              borderRadius: roundedMd,
              padding: spacingMd,
              marginBottom: spacingMd,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '500' }}>
              {section.title || 'Metrics'}
            </Text>
            <Ionicons name="trending-up-outline" size={16} color={secondaryColor} />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text, marginTop: 4 }}>
            {metricValue}
          </Text>
        </View>
      );
    }

    if (section.type === 'data-table') {
      const rows = tableData[layout.moduleName] || [];
      return (
        <View key={sectionKey} style={[styles.sectionContainer, { marginBottom: spacingLg }]}>
          <Text style={[styles.sectionTitle, { color: primaryColor, ...designTokens.typography.h2 }]}>
            {section.title || 'Details'}
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
                      paddingVertical: spacingSm,
                      paddingHorizontal: spacingSm,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>
                    {row.title || row.id}
                  </Text>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
                    {row.value ? `$${row.value}` : row.type || ''}
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
      {layouts.map(layout => (
        <View key={layout.moduleName} style={styles.moduleBlock}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacingSm }}>
            <Ionicons name="cube-outline" size={18} color={secondaryColor} style={{ marginRight: 6 }} />
            <Text style={[styles.moduleTitle, { color: primaryColor, fontWeight: '700' }]}>
              {layout.moduleName.toUpperCase()}
            </Text>
          </View>
          {layout.sections.map((section, idx) => renderSection(section, layout, idx))}
        </View>
      ))}

      {/* Action Input Parameters Modal Form */}
      <Modal visible={selectedAction !== null} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1, borderRadius: roundedMd }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>
                {selectedAction?.name.replace(/_/g, ' ')}
              </Text>
              <TouchableOpacity onPress={() => setSelectedAction(null)} disabled={submitting}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300, marginVertical: 12 }}>
              {selectedAction?.params.map(p => (
                <View key={p.name} style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 4 }}>
                    {p.name.replace(/_/g, ' ')} {p.required ? '*' : ''}
                  </Text>
                  <TextInput
                    style={[styles.formInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.background }]}
                    value={formParams[p.name]}
                    onChangeText={text => setFormParams(prev => ({ ...prev, [p.name]: text }))}
                    placeholder={`Enter ${p.name.replace(/_/g, ' ')}`}
                    placeholderTextColor={theme.textMuted}
                    keyboardType={p.type === 'number' ? 'numeric' : 'default'}
                    editable={!submitting}
                  />
                </View>
              ))}
            </ScrollView>

            {resultMessage && (
              <Text style={{ fontSize: 14, color: primaryColor, textAlign: 'center', marginBottom: 12 }}>
                {resultMessage}
              </Text>
            )}

            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.submitBtn, { backgroundColor: primaryColor, borderRadius: roundedSm }]}
              onPress={handleFormSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Submit Action</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
