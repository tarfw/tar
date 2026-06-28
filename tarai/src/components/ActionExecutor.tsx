import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Pressable,
  View,
  Text,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';

// Flue: ActionDef now comes from Valibot schemas in defineAction
type ActionDef = { id: string; name: string; description: string; [key: string]: any };
type ExecutionState = { steps: ExecutionStep[]; currentStep: number; status: string };
type ExecutionStep = { name: string; status: StepStatus; result?: any };
type StepStatus = 'pending' | 'running' | 'done' | 'error';

function createInitialState(steps: string[]): ExecutionState {
  return { steps: steps.map(name => ({ name, status: 'pending' })), currentStep: 0, status: 'running' };
}

async function runActionExecution(state: ExecutionState, db: any): Promise<ExecutionState> {
  return { ...state, status: 'done' };
}

interface Props {
  action: ActionDef;
  values: Record<string, any>;
  onDone: (result: { id: string; title: string }, values: Record<string, any>) => void;
  onCancel: () => void;
}

const STATUS_COLOR: Record<StepStatus, string> = {
  pending: '#6B7280',
  running: '#3B82F6',
  success: '#10B981',
  failed: '#EF4444',
  skipped: '#9CA3AF',
};

const STATUS_ICON: Record<StepStatus, keyof typeof Ionicons.glyphMap> = {
  pending: 'ellipse-outline',
  running: 'sync',
  success: 'checkmark-circle',
  failed: 'close-circle',
  skipped: 'remove-circle-outline',
};

function StepRow({ step, isLast }: { step: ExecutionStep; isLast: boolean }) {
  const theme = useTheme();
  const color = STATUS_COLOR[step.status];

  return (
    <View style={styles.stepRow}>
      <View style={styles.stepLeft}>
        <View style={[styles.stepDot, { backgroundColor: color + '20' }]}>
          <Ionicons name={STATUS_ICON[step.status]} size={16} color={color} />
        </View>
        {!isLast && <View style={[styles.stepLine, { backgroundColor: theme.backgroundElement }]} />}
      </View>

      <View style={styles.stepContent}>
        <View style={styles.stepTop}>
          <Text style={[styles.stepLabel, { color: theme.text }]}>{step.label}</Text>
          {step.durationMs != null && step.status !== 'pending' && step.status !== 'running' && (
            <Text style={[styles.stepDuration, { color: theme.textSecondary }]}>{step.durationMs}ms</Text>
          )}
        </View>
        <Text style={[styles.stepDetail, { color: theme.textSecondary }]}>{step.detail}</Text>
        {step.result != null && (
          <Text style={[styles.stepResult, { color }]}>{step.result}</Text>
        )}
        {step.error != null && (
          <Text style={styles.stepError}>{step.error}</Text>
        )}
      </View>
    </View>
  );
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.progressBg, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function ActionExecutor({ action, values, onDone, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const db = useDb();
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<ExecutionState>(() => createInitialState(action));

  const completedCount = state.steps.filter((s) => s.status === 'success').length;
  const totalCount = state.steps.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        await runActionExecution(db, action, values, setState, controller.signal);
      } catch (e: any) {
        if (e.message !== 'cancelled' && !cancelled) {
          console.error('[ActionExecutor]', e);
        }
      }
    })();

    return () => { cancelled = true; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    onCancel();
  }, [onCancel]);

  const barColor =
    state.status === 'completed' ? '#10B981' :
    state.status === 'failed' ? '#EF4444' :
    state.status === 'cancelled' ? '#F59E0B' : '#3B82F6';

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
        <Pressable onPress={handleCancel} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{action.name}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View style={styles.progressSection}>
          <ProgressBar percent={percent} color={barColor} />
          <View style={styles.progressMeta}>
            <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
              {state.status === 'completed' ? 'Complete' :
               state.status === 'failed' ? 'Failed' :
               state.status === 'cancelled' ? 'Cancelled' :
               `${completedCount} of ${totalCount}`}
            </Text>
            {state.totalMs != null && (
              <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
                {state.totalMs}ms
              </Text>
            )}
          </View>
        </View>

        <View style={styles.stepsSection}>
          {state.steps.map((step, i) => (
            <StepRow key={step.id} step={step} isLast={i === state.steps.length - 1} />
          ))}
        </View>

        {state.status === 'completed' && (
          <View style={[styles.banner, { backgroundColor: '#10B98115' }]}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={[styles.bannerText, { color: '#10B981' }]}>
              {action.name} executed successfully
            </Text>
          </View>
        )}

        {state.status === 'failed' && (
          <View style={[styles.banner, { backgroundColor: '#EF444415' }]}>
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <Text style={[styles.bannerText, { color: '#EF4444' }]}>
              {state.errorMessage || 'Execution failed'}
            </Text>
          </View>
        )}
      </ScrollView>

      {state.status === 'completed' && (
        <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.backgroundElement, paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: '#10B981' }]}
            onPress={() => {
              if (state.result) onDone(state.result, values);
            }}>
            <Text style={styles.primaryBtnText}>Done</Text>
          </Pressable>
        </View>
      )}

      {state.status === 'failed' && (
        <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.backgroundElement, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.footerRow}>
            <Pressable
              style={[styles.secondaryBtn, { backgroundColor: theme.backgroundElement }]}
              onPress={() => { setState(createInitialState(action)); }}>
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Retry</Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, { backgroundColor: '#EF4444', flex: 1 }]} onPress={handleCancel}>
              <Text style={styles.primaryBtnText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'center' },
  scroll: { flex: 1 },

  progressSection: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressLabel: { fontSize: 13, fontWeight: '500' },

  stepsSection: { paddingHorizontal: 20, paddingTop: 16 },

  stepRow: { flexDirection: 'row', minHeight: 48 },
  stepLeft: { width: 32, alignItems: 'center' },
  stepDot: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  stepLine: { width: 2, flex: 1, minHeight: 20, marginTop: 4 },
  stepContent: { flex: 1, paddingBottom: 12, paddingLeft: 8 },
  stepTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepLabel: { fontSize: 15, fontWeight: '500' },
  stepDuration: { fontSize: 12, fontWeight: '500' },
  stepDetail: { fontSize: 13, marginTop: 2 },
  stepResult: { fontSize: 13, marginTop: 4, fontWeight: '500' },
  stepError: { fontSize: 13, marginTop: 4, color: '#EF4444', fontWeight: '500' },

  progressBg: { height: 4, borderRadius: 2 },
  progressFill: { height: 4, borderRadius: 2 },

  banner: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 20,
    marginTop: 16, padding: 14, borderRadius: 12, gap: 10,
  },
  bannerText: { fontSize: 14, fontWeight: '500', flex: 1 },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 12,
  },
  footerRow: { flexDirection: 'row', gap: 12 },
  primaryBtn: { height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { height: 48, paddingHorizontal: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { fontSize: 16, fontWeight: '500' },
});
