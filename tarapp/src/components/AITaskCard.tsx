import { StyleSheet, View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';

export interface ParamDef {
  name: string;
  type: 'text' | 'number';
  required: boolean;
}

export interface AITask {
  name: string;
  module: string;
  purpose: string;
  intents: string[];
  params: ParamDef[];
  steps: number;
  tool: string;
  table: string;
  type: string;
}

interface AITaskCardProps {
  task: AITask;
  onPress: () => void;
}

const getModuleIcon = (mod: string) => {
  switch (mod.toLowerCase()) {
    case 'orders': return 'cart-outline';
    case 'inventory': return 'cube-outline';
    case 'crm': return 'people-outline';
    case 'bookings': return 'calendar-outline';
    case 'documents': return 'document-text-outline';
    case 'expenses': return 'card-outline';
    case 'reports': return 'bar-chart-outline';
    default: return 'flash-outline';
  }
};

const humanizeActionName = (name: string) => {
  return name
    .replace(/^action_/i, '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export function AITaskCard({ task, onPress }: AITaskCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
        },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: theme.background }]}>
        <Ionicons name={getModuleIcon(task.module)} size={22} color={theme.primary} />
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {humanizeActionName(task.name)}
          </Text>
          <View style={[styles.badge, { backgroundColor: theme.background }]}>
            <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
              {task.module}
            </Text>
          </View>
        </View>

        <Text style={[styles.purpose, { color: theme.textMuted }]} numberOfLines={2}>
          {task.purpose}
        </Text>

        <View style={styles.footer}>
          <View style={styles.metaItem}>
            <Ionicons name="git-commit-outline" size={14} color={theme.textMuted} />
            <Text style={[styles.metaText, { color: theme.textMuted }]}>
              {task.steps} {task.steps === 1 ? 'step' : 'steps'}
            </Text>
          </View>

          {task.params.length > 0 && (
            <View style={styles.metaItem}>
              <Ionicons name="options-outline" size={14} color={theme.textMuted} />
              <Text style={[styles.metaText, { color: theme.textMuted }]}>
                {task.params.length} {task.params.length === 1 ? 'param' : 'params'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={styles.arrow} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  purpose: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
  },
  arrow: {
    marginLeft: 4,
  },
});
